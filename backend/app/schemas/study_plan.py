"""Goal-based study plans spanning one or more courses.

The AI decides the strategy (which courses, in what order, how important each is, and how to share
study days); the app's scheduler turns it into concrete daily tasks. Drafts are never stored: the
learner refines a draft, and only an accepted plan is saved.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.enums import Level

PlanFocus = Literal["complete_course", "weak_topics", "exam_prep"]
TaskType = Literal["read", "learn", "practice", "quiz", "final_test", "course_exam"]
PLAN_FOCUSES = ("complete_course", "weak_topics", "exam_prep")
MAX_PLAN_COURSES = 5


class PlanSettings(BaseModel):
    # Weekdays the learner can study: 0 = Monday … 6 = Sunday.
    study_days: list[int] = Field(min_length=1, max_length=7)
    minutes_per_day: int = Field(ge=15, le=240)
    # Optional: without a deadline the plan simply shows when it would finish.
    target_date: date | None = None

    @field_validator("study_days")
    @classmethod
    def valid_days(cls, days: list[int]) -> list[int]:
        if any(day < 0 or day > 6 for day in days):
            raise ValueError("Study days must be between 0 (Monday) and 6 (Sunday).")
        return sorted(set(days))


# ---------- AI output schemas (no default values: Gemini's schema support is limited) ----------


class SuggestedCourse(BaseModel):
    subject_slug: str
    # "core", "supporting" or "optional".
    role: str
    reason: str


class CourseSuggestionResponse(BaseModel):
    message: str
    courses: list[SuggestedCourse]
    # Parts of the goal the catalogue doesn't cover yet (e.g. "SQL").
    not_available: list[str]


class StrategyCourse(BaseModel):
    subject_slug: str
    # How much study time this course gets while it's active, relative to the others (1-10).
    weight: int = Field(ge=1, le=10)
    focus: str
    # Courses (earlier in the list) this one builds on.
    depends_on: list[str]
    # Start once this many topics of each dependency are done; -1 means after the whole course.
    start_after_topics: int
    reason: str

    @field_validator("focus")
    @classmethod
    def valid_focus(cls, value: str) -> str:
        return value if value in PLAN_FOCUSES else "complete_course"


class PlanStrategy(BaseModel):
    summary: str
    # "split": several courses share each study day; "alternate": one course per day.
    day_sharing: str
    day_sharing_reason: str
    # In the recommended order.
    courses: list[StrategyCourse] = Field(min_length=1, max_length=MAX_PLAN_COURSES)

    @field_validator("day_sharing")
    @classmethod
    def valid_sharing(cls, value: str) -> str:
        return value if value in ("split", "alternate") else "split"


class StrategyResponse(BaseModel):
    strategy: PlanStrategy
    # Set only when the learner's change request is about their schedule; null otherwise.
    study_days: list[int] | None
    minutes_per_day: int | None
    target_date: str | None
    changes_explained: str


# ---------- API ----------


class GoalIn(BaseModel):
    goal: str = Field(min_length=3, max_length=500)
    level: Level


class DraftRequest(GoalIn):
    courses: list[str] = Field(min_length=1, max_length=MAX_PLAN_COURSES)
    settings: PlanSettings
    # The draft being refined, if any. Without a change request it is just rescheduled (no AI call).
    strategy: PlanStrategy | None = None
    change_request: str | None = Field(default=None, max_length=500)


class AcceptRequest(GoalIn):
    courses: list[str] = Field(min_length=1, max_length=MAX_PLAN_COURSES)
    settings: PlanSettings
    strategy: PlanStrategy


class CourseShare(BaseModel):
    subject_slug: str
    subject_name: str
    percent: int


class PlanPhase(BaseModel):
    start_date: date
    end_date: date
    shares: list[CourseShare]


class PlanTask(BaseModel):
    id: str
    subject_slug: str
    subject_name: str
    type: TaskType
    # Empty for a course exam.
    topic_slug: str
    title: str
    detail: str
    minutes: int
    done: bool
    # True when the app ticked it (a passed test) rather than the learner.
    auto_done: bool = False


class PlanDay(BaseModel):
    date: date
    tasks: list[PlanTask]


class PlanCourse(BaseModel):
    subject_slug: str
    subject_name: str
    reason: str
    # The course's real progress, including anything done before the plan.
    completion_percent: int = 0
    topics_completed: int = 0
    topics_total: int = 0


class DraftOut(BaseModel):
    goal: str
    level: Level
    courses: list[str]
    settings: PlanSettings
    strategy: PlanStrategy
    course_details: list[PlanCourse]
    phases: list[PlanPhase]
    # The first week or so of the schedule, as a preview.
    preview_days: list[PlanDay]
    total_tasks: int
    finish_date: date | None
    fits: bool
    # What the last chat request changed (empty for a first draft).
    changes_explained: str


class StudyPlanOut(BaseModel):
    goal: str
    level: Level
    settings: PlanSettings
    strategy: PlanStrategy
    course_details: list[PlanCourse]
    # Average completion of the plan's courses: real progress toward the goal.
    goal_progress: int
    phases: list[PlanPhase]
    created_at: datetime
    today: date
    days: list[PlanDay]
    total_tasks: int
    done_tasks: int
    fits: bool
    estimated_finish: date | None
    # Unfinished tasks scheduled before today: the learner is behind and may want to replan.
    overdue_tasks: int


class TaskUpdate(BaseModel):
    done: bool