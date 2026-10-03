from datetime import datetime

from pydantic import BaseModel

from app.models.enums import CompletionStatus, LearningMode, Level, Mastery


class CompletionRequirement(BaseModel):
    label: str
    met: bool
    progress: str


class TopicProgressOut(BaseModel):
    topic_slug: str
    topic_name: str
    questions_attempted: int
    correct_answers: int
    accuracy: float
    mastery: Mastery
    current_difficulty: Level
    strengths: list[str]
    weaknesses: list[str]
    last_attempted_at: datetime | None
    # Completion standard (see progress_service.calculate_completion).
    completion_percent: int
    completion_status: CompletionStatus
    completed: bool
    remarks: list[str]
    requirements: list[CompletionRequirement]
    concepts_covered: list[str]
    concepts_remaining: list[str]
    recent_correct: int
    recent_answered: int
    final_test_passed: bool
    final_test_best: float | None
    # Everything but the final test is done, so the learner should take it next.
    ready_for_final_test: bool
    # New attempts still allowed after passing; null until the test is passed (no limit before that).
    final_test_attempts_left: int | None
    # Failed attempts in a row (before passing), and when a locked test opens again (null if not locked).
    final_test_fails_in_row: int
    final_test_locked_until: datetime | None


class OverallProgress(BaseModel):
    subject_slug: str
    subject_name: str
    questions_attempted: int
    correct_answers: int
    accuracy: float
    completion_percent: int
    topics_completed: int
    # The course is complete when every topic is complete and the course exam is passed.
    course_completed: bool
    course_exam_unlocked: bool
    course_exam_passed: bool
    course_exam_best: float | None
    # Set while the course exam is cooling down after a failed attempt.
    course_exam_locked_until: datetime | None
    topics_remaining: list[str]
    course_remarks: list[str]
    topics: list[TopicProgressOut]


class RecommendationResponse(BaseModel):
    subject_slug: str
    # Empty when the recommendation is the course exam rather than a topic.
    topic_slug: str
    topic_name: str
    reason: str
    message: str
    # A learning mode ("learn", "practice", "quiz"), or "final_test" / "course_exam".
    suggested_mode: str
    suggested_difficulty: Level