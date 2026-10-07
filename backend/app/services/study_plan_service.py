"""Goal-based study plans across one or more courses.

Who decides what:
- The AI decides the strategy: which courses serve the goal, their order and dependencies, how
  important each is (weight), and whether courses share study days or alternate.
- The scheduler below turns that strategy into concrete daily tasks using each course's real
  remaining work, the learner's daily time limit, and the dependencies. The AI never invents tasks,
  so the schedule always respects time limits and links to real pages.

Drafts are never stored. Only an accepted plan is saved, and every change to what's in the plan
produces a new draft the learner approves.
"""

import math
import uuid
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime, timedelta

from app.core.exceptions import NotFoundError
from app.db.mongodb import get_database
from app.models.enums import CompletionStatus
from app.models.user import User
from app.prompts.plan_prompt import (
    PLANNER_SYSTEM_PROMPT,
    build_course_suggestion_prompt,
    build_strategy_prompt,
)
from app.schemas.progress import OverallProgress, TopicProgressOut
from app.schemas.study_plan import (
    AcceptRequest,
    CourseShare,
    CourseSuggestionResponse,
    DraftOut,
    DraftRequest,
    GoalIn,
    PlanCourse,
    PlanDay,
    PlanPhase,
    PlanSettings,
    PlanStrategy,
    PlanTask,
    StrategyCourse,
    StrategyResponse,
    StudyPlanOut,
)
from app.services import gamification_service, progress_service, subject_service, topic_service, user_service
from app.services.ai_service import StructuredLLM

# Rough task lengths in minutes.
READ_MINUTES = 15
LEARN_MINUTES = 20
REVIEW_MINUTES = 15
PRACTICE_MINUTES = 15
QUIZ_MINUTES = 10
FINAL_TEST_MINUTES = 15
QUESTIONS_PER_PRACTICE = 5
COURSE_EXAM_MINUTES_PER_TOPIC = 3  # 2 questions per topic at 90 seconds each
MAX_PLAN_DAYS = 730
PREVIEW_STUDY_DAYS = 7
# Phases group weeks with the same course split; shares are rounded to this many percent.
PHASE_ROUNDING = 10


@dataclass
class TaskDraft:
    subject_slug: str
    type: str
    topic_slug: str
    title: str
    detail: str
    minutes: int
    # True for a topic's last task: once scheduled, the topic counts as done for dependencies.
    completes_topic: bool = False
    # Practice sessions are numbered: session 2 ticks itself once 10 questions are answered.
    sequence: int = 1


# ---------- Tasks for one course (pure) ----------


def practice_sessions_needed(topic: TopicProgressOut) -> int:
    """Practice sessions (about 5 questions each) to meet the topic's practice requirements."""
    if topic.ready_for_final_test or topic.completed:
        return 0
    more_questions = max(0, progress_service.MIN_QUESTIONS_FOR_COMPLETION - topic.questions_attempted)
    more_correct = max(0, progress_service.REQUIRED_RECENT_CORRECT - topic.recent_correct)
    questions = max(more_questions, more_correct, len(topic.concepts_remaining))
    return max(1, math.ceil(questions / QUESTIONS_PER_PRACTICE))


def _topic_tasks(subject: str, topic: TopicProgressOut, focus: str) -> list[TaskDraft]:
    slug, name = topic.topic_slug, topic.topic_name
    struggling = topic.completion_status == CompletionStatus.NEEDS_PRACTICE
    tasks: list[TaskDraft] = []

    def add(kind: str, title: str, detail: str, minutes: int, sequence: int = 1) -> None:
        tasks.append(TaskDraft(subject, kind, slug, title, detail, minutes, sequence=sequence))

    sessions = practice_sessions_needed(topic)
    focus_note = f" Focus on: {', '.join(topic.concepts_remaining[:3])}." if topic.concepts_remaining else ""

    if focus == "exam_prep":
        if struggling and sessions:
            add("practice", f"Practice {name}", f"Answer about {QUESTIONS_PER_PRACTICE} questions.{focus_note}",
                PRACTICE_MINUTES)
        if not topic.ready_for_final_test:
            add("quiz", f"{name} quiz", "Check what you know with a 5-question quiz.", QUIZ_MINUTES)
    else:
        if topic.questions_attempted == 0 and focus == "complete_course":
            add("read", f"Read: {name}", "Read the study notes for this topic.", READ_MINUTES)
            add("learn", f"Learn: {name}", "Ask the tutor about anything unclear.", LEARN_MINUTES)
        elif struggling:
            add("learn", f"Review: {name}", "Go over the parts you found hard with the tutor.", REVIEW_MINUTES)
        for number in range(1, sessions + 1):
            label = f" ({number} of {sessions})" if sessions > 1 else ""
            detail = f"Answer about {QUESTIONS_PER_PRACTICE} questions.{focus_note}"
            add("practice", f"Practice {name}{label}", detail, PRACTICE_MINUTES, sequence=number)
        if sessions:
            add("quiz", f"{name} quiz", "Check your progress with a 5-question quiz.", QUIZ_MINUTES)

    if not topic.final_test_passed:
        pass_note = f"Score {progress_service.FINAL_TEST_PASS_MARK:.0f}% or more to complete the topic."
        add("final_test", f"{name} final test", pass_note, FINAL_TEST_MINUTES)
    if tasks:
        tasks[-1].completes_topic = True
    return tasks


def build_course_tasks(course: OverallProgress, focus: str) -> list[TaskDraft]:
    """Everything the learner still needs to do in one course, for the given focus."""
    topics = [topic for topic in course.topics if not topic.completed]
    if focus == "weak_topics":
        topics = sorted((t for t in topics if t.questions_attempted > 0), key=lambda t: t.accuracy)
    tasks = [task for topic in topics for task in _topic_tasks(course.subject_slug, topic, focus)]
    if not course.course_exam_passed and focus != "weak_topics":
        tasks.append(
            TaskDraft(
                course.subject_slug,
                "course_exam",
                "",
                f"{course.subject_name} course exam",
                "Unlocks once every topic is complete. Pass it to complete the course.",
                max(15, COURSE_EXAM_MINUTES_PER_TOPIC * len(course.topics)),
                completes_topic=True,
            )
        )
    return tasks


# ---------- Strategy checks and scheduling across courses (pure) ----------


def normalize_strategy(strategy: PlanStrategy, courses: list[str]) -> PlanStrategy:
    """Make an AI strategy safe to schedule: exactly the plan's courses, and dependencies only on
    courses earlier in the list (which also rules out circular dependencies)."""
    by_slug = {course.subject_slug: course for course in strategy.courses if course.subject_slug in courses}
    ordered = [by_slug[slug] for slug in [c.subject_slug for c in strategy.courses] if slug in by_slug]
    ordered = list({course.subject_slug: course for course in ordered}.values())
    for slug in courses:  # a course the AI left out joins at the end, independently
        if slug not in by_slug:
            ordered.append(
                StrategyCourse(
                    subject_slug=slug,
                    weight=5,
                    focus="complete_course",
                    depends_on=[],
                    start_after_topics=0,
                    reason="Studied alongside the rest of the plan.",
                )
            )
    cleaned, earlier = [], []
    for course in ordered:
        depends = [slug for slug in course.depends_on if slug in earlier]
        start_after = course.start_after_topics if depends else 0
        cleaned.append(course.model_copy(update={"depends_on": depends, "start_after_topics": start_after}))
        earlier.append(course.subject_slug)
    return strategy.model_copy(update={"courses": cleaned})


def schedule_plan(
    course_tasks: dict[str, list[TaskDraft]],
    topic_counts: dict[str, int],
    topics_done: dict[str, int],
    strategy: PlanStrategy,
    settings: PlanSettings,
    start: date,
) -> list[tuple[date, list[TaskDraft]]]:
    """Fill study days across courses.

    Each active course earns study-time "credit" every day in proportion to its weight and spends it
    on its tasks, so over time each course gets its fair share even when tasks don't divide evenly.
    With "alternate" sharing a study day goes to a single course. A course becomes active once its
    dependencies have enough topics scheduled (its head start). Days never go over the time limit,
    except that a task longer than a whole day gets a day to itself.
    """
    queues = {slug: list(tasks) for slug, tasks in course_tasks.items()}
    done = dict(topics_done)
    credit: dict[str, float] = defaultdict(float)
    by_slug = {course.subject_slug: course for course in strategy.courses}
    capacity = settings.minutes_per_day

    def unlocked(slug: str) -> bool:
        course = by_slug[slug]
        for dependency in course.depends_on:
            needed = topic_counts.get(dependency, 0) if course.start_after_topics < 0 else course.start_after_topics
            finished = not queues.get(dependency)
            if not finished and done.get(dependency, 0) < needed:
                return False
        return True

    schedule: list[tuple[date, list[TaskDraft]]] = []
    day = start
    while any(queues.values()) and (day - start).days <= MAX_PLAN_DAYS:
        if day.weekday() in settings.study_days:
            active = [slug for slug in by_slug if queues.get(slug) and unlocked(slug)]
            if not active:  # safety net: never stall on dependencies
                active = [slug for slug in by_slug if queues.get(slug)]
            total_weight = sum(by_slug[slug].weight for slug in active)
            for slug in active:
                credit[slug] += capacity * by_slug[slug].weight / total_weight

            if strategy.day_sharing == "alternate":
                candidates = [max(active, key=lambda slug: credit[slug])]
            else:
                candidates = sorted(active, key=lambda slug: -credit[slug])

            todays: list[TaskDraft] = []
            used = 0
            progress = True
            while progress:
                progress = False
                for slug in sorted(candidates, key=lambda s: -credit[s]):
                    queue = queues[slug]
                    if not queue:
                        continue
                    task = queue[0]
                    fits_today = used + task.minutes <= capacity
                    affordable = task.minutes <= credit[slug] + 0.01
                    # An empty day always takes the most-owed course's next task, so no day is wasted.
                    if (fits_today and affordable) or not todays:
                        queue.pop(0)
                        todays.append(task)
                        used += task.minutes
                        credit[slug] -= task.minutes
                        if task.completes_topic:
                            done[slug] = done.get(slug, 0) + 1
                        progress = True
                        break
            if todays:
                schedule.append((day, todays))
        day += timedelta(days=1)
    return schedule


def summarize_phases(
    schedule: list[tuple[date, list[TaskDraft]]], names: dict[str, str], start: date
) -> list[PlanPhase]:
    """Group weeks with the same course split into phases, e.g. weeks 1-3: Python 100%."""
    weeks: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    week_dates: dict[int, list[date]] = defaultdict(list)
    for day, tasks in schedule:
        week = (day - start).days // 7
        week_dates[week].append(day)
        for task in tasks:
            weeks[week][task.subject_slug] += task.minutes

    phases: list[PlanPhase] = []
    previous_key = None
    for week in sorted(weeks):
        minutes = weeks[week]
        total = sum(minutes.values())
        shares = {
            slug: int(round(value * 100 / total / PHASE_ROUNDING) * PHASE_ROUNDING) for slug, value in minutes.items()
        }
        key = tuple(sorted((slug, share) for slug, share in shares.items() if share > 0))
        if phases and key == previous_key:
            phases[-1].end_date = max(week_dates[week])
            continue
        phases.append(
            PlanPhase(
                start_date=min(week_dates[week]),
                end_date=max(week_dates[week]),
                shares=[
                    CourseShare(subject_slug=slug, subject_name=names.get(slug, slug), percent=percent)
                    for slug, percent in sorted(shares.items(), key=lambda item: -item[1])
                    if percent > 0
                ],
            )
        )
        previous_key = key
    return phases


# ---------- Building schedules from the database ----------


async def _course_pictures(user: User, courses: list[str]) -> dict[str, OverallProgress]:
    pictures: dict[str, OverallProgress] = {}
    for slug in courses:
        try:
            pictures[slug] = await progress_service.get_overall_progress(user, slug)
        except NotFoundError:
            continue  # a course deleted by an admin simply drops out of the plan
    return pictures


async def _schedule(user: User, courses: list[str], strategy: PlanStrategy, settings: PlanSettings, start: date):
    pictures = await _course_pictures(user, courses)
    focus = {course.subject_slug: course.focus for course in strategy.courses}
    course_tasks = {
        slug: build_course_tasks(progress, focus.get(slug, "complete_course")) for slug, progress in pictures.items()
    }
    topic_counts = {slug: len(progress.topics) for slug, progress in pictures.items()}
    topics_done = {slug: progress.topics_completed for slug, progress in pictures.items()}
    live_courses = [course for course in strategy.courses if course.subject_slug in pictures]
    live_strategy = strategy.model_copy(update={"courses": live_courses})
    schedule = schedule_plan(course_tasks, topic_counts, topics_done, live_strategy, settings, start)
    return schedule, pictures


def _course_details(strategy: PlanStrategy, pictures: dict[str, OverallProgress]) -> list[PlanCourse]:
    """Each course with its real progress, so work done before the plan is visible too."""
    return [
        PlanCourse(
            subject_slug=course.subject_slug,
            subject_name=pictures[course.subject_slug].subject_name,
            reason=course.reason,
            completion_percent=pictures[course.subject_slug].completion_percent,
            topics_completed=pictures[course.subject_slug].topics_completed,
            topics_total=len(pictures[course.subject_slug].topics),
        )
        for course in strategy.courses
        if course.subject_slug in pictures
    ]


def _today(timezone: str) -> date:
    return gamification_service.today_in(gamification_service.resolve_timezone(timezone))


# ---------- AI steps: course suggestions and drafts ----------


async def suggest_courses(user: User, goal: GoalIn, ai: StructuredLLM) -> CourseSuggestionResponse:
    catalogue_lines = []
    subjects = await subject_service.list_subjects()
    for subject in subjects:
        topics = ", ".join(topic.name for topic in await topic_service.list_topics(subject.slug))
        catalogue_lines.append(f"- {subject.slug}: {subject.name}. {subject.description} Topics: {topics}")
    current = await _course_pictures(user, subject_service.plan_subjects(user))
    current_lines = [f"- {p.subject_name}: {p.completion_percent}% complete" for p in current.values()] or ["- none"]

    suggestion = await ai.generate_structured(
        system_prompt=PLANNER_SYSTEM_PROMPT,
        user_prompt=build_course_suggestion_prompt(
            goal.goal, goal.level.value, "\n".join(catalogue_lines), "\n".join(current_lines)
        ),
        response_model=CourseSuggestionResponse,
    )
    valid = {subject.slug for subject in subjects}
    unique = {course.subject_slug: course for course in suggestion.courses if course.subject_slug in valid}
    return suggestion.model_copy(update={"courses": list(unique.values())})


def _apply_schedule_changes(settings: PlanSettings, response: StrategyResponse, today: date) -> PlanSettings:
    """Apply schedule changes the AI read from the learner's request, ignoring anything invalid."""
    changes: dict = {}
    if response.study_days:
        days = sorted({day for day in response.study_days if 0 <= day <= 6})
        if days:
            changes["study_days"] = days
    if response.minutes_per_day and 15 <= response.minutes_per_day <= 240:
        changes["minutes_per_day"] = response.minutes_per_day
    if response.target_date:
        try:
            target = date.fromisoformat(response.target_date)
            if target >= today:
                changes["target_date"] = target
        except ValueError:
            pass
    return settings.model_copy(update=changes)


async def build_draft(user: User, request: DraftRequest, ai: StructuredLLM, timezone: str) -> DraftOut:
    today = _today(timezone)
    courses = list(dict.fromkeys(request.courses))
    for slug in courses:
        await subject_service.get_subject(slug)
    settings = request.settings
    strategy = request.strategy
    explained = ""

    if strategy is None or request.change_request:
        pictures = await _course_pictures(user, courses)
        course_lines = [
            f"- {slug}: {p.subject_name}, {p.completion_percent}% complete, "
            f"{len(p.topics) - p.topics_completed} of {len(p.topics)} topics left, course exam "
            f"{'passed' if p.course_exam_passed else 'not passed'}"
            for slug, p in pictures.items()
        ]
        settings_line = (
            f"study days {settings.study_days} (0 = Monday), {settings.minutes_per_day} minutes per day, "
            f"target date {settings.target_date or 'none'}, today is {today}"
        )
        response = await ai.generate_structured(
            system_prompt=PLANNER_SYSTEM_PROMPT,
            user_prompt=build_strategy_prompt(
                request.goal,
                request.level.value,
                "\n".join(course_lines),
                settings_line,
                strategy.model_dump_json() if strategy else None,
                request.change_request,
            ),
            response_model=StrategyResponse,
        )
        strategy = response.strategy
        settings = _apply_schedule_changes(settings, response, today)
        explained = response.changes_explained

    strategy = normalize_strategy(strategy, courses)
    schedule, pictures = await _schedule(user, courses, strategy, settings, today)
    names = {slug: progress.subject_name for slug, progress in pictures.items()}
    finish = schedule[-1][0] if schedule else None
    return DraftOut(
        goal=request.goal,
        level=request.level,
        courses=courses,
        settings=settings,
        strategy=strategy,
        course_details=_course_details(strategy, pictures),
        phases=summarize_phases(schedule, names, today),
        preview_days=[_to_day(day, tasks, names) for day, tasks in schedule[:PREVIEW_STUDY_DAYS]],
        total_tasks=sum(len(tasks) for _, tasks in schedule),
        finish_date=finish,
        fits=finish is None or settings.target_date is None or finish <= settings.target_date,
        changes_explained=explained,
    )


def _to_day(day: date, tasks: list[TaskDraft], names: dict[str, str], ids: list[str] | None = None) -> PlanDay:
    return PlanDay(
        date=day,
        tasks=[
            PlanTask(
                id=ids[index] if ids else f"preview-{index}",
                subject_slug=task.subject_slug,
                subject_name=names.get(task.subject_slug, task.subject_slug),
                type=task.type,
                topic_slug=task.topic_slug,
                title=task.title,
                detail=task.detail,
                minutes=task.minutes,
                done=False,
            )
            for index, task in enumerate(tasks)
        ],
    )


# ---------- The accepted plan ----------


QUIZ_QUESTIONS = 5


@dataclass
class PlanActivity:
    read_topics: set[str]
    learn_messages: dict[str, int]
    practice_answers: dict[str, int]
    quiz_answers: dict[str, int]


async def record_reading(user_id: str, topic_slug: str) -> None:
    """Remember that the learner opened a topic's study notes (ticks "Read" plan tasks)."""
    await get_database().reading_log.update_one(
        {"user_id": user_id, "topic_slug": topic_slug}, {"$set": {"last_read_at": datetime.now(UTC)}}, upsert=True
    )


async def _activity_since(user_id: str, since: datetime) -> PlanActivity:
    db = get_database()
    read_topics = {
        document["topic_slug"]
        async for document in db.reading_log.find({"user_id": user_id, "last_read_at": {"$gte": since}})
    }

    answers = await db.attempts.aggregate(
        [
            {"$match": {"user_id": user_id, "created_at": {"$gte": since}, "counted_in_progress": True}},
            {"$group": {"_id": {"topic": "$topic_slug", "mode": "$mode"}, "count": {"$sum": 1}}},
        ]
    )
    practice: dict[str, int] = defaultdict(int)
    quiz: dict[str, int] = defaultdict(int)
    async for row in answers:
        target = quiz if row["_id"]["mode"] == "quiz" else practice if row["_id"]["mode"] == "practice" else None
        if target is not None:
            target[row["_id"]["topic"]] += row["count"]

    messages = await db.sessions.aggregate(
        [
            {"$match": {"user_id": user_id, "mode": "learn"}},
            {"$unwind": "$messages"},
            {"$match": {"messages.role": "student", "messages.created_at": {"$gte": since}}},
            {"$group": {"_id": "$topic_slug", "count": {"$sum": 1}}},
        ]
    )
    learn = {row["_id"]: row["count"] async for row in messages}
    return PlanActivity(read_topics=read_topics, learn_messages=learn, practice_answers=practice, quiz_answers=quiz)


def _task_fields(task: TaskDraft) -> dict:
    fields = asdict(task)
    fields.pop("completes_topic")  # only needed while scheduling
    return fields


def _query(user: User) -> dict:
    return {"user_id": user.id}


async def _stored_days(
    user: User, courses: list[str], strategy: PlanStrategy, settings: PlanSettings, today: date
) -> list[dict]:
    schedule, _ = await _schedule(user, courses, strategy, settings, today)
    return [
        {
            # Dates are stored as ISO strings: MongoDB has no date-only type.
            "date": day.isoformat(),
            "tasks": [
                {**_task_fields(task), "id": uuid.uuid4().hex, "done": False}
                for task in tasks
            ],
        }
        for day, tasks in schedule
    ]


async def accept_plan(user: User, request: AcceptRequest, timezone: str) -> StudyPlanOut:
    today = _today(timezone)
    courses = list(dict.fromkeys(request.courses))
    for slug in courses:
        await subject_service.get_subject(slug)
    strategy = normalize_strategy(request.strategy, courses)
    document = {
        **_query(user),
        "goal": request.goal,
        "level": request.level.value,
        "courses": courses,
        "settings": request.settings.model_dump(mode="json"),
        "strategy": strategy.model_dump(),
        "days": await _stored_days(user, courses, strategy, request.settings, today),
        "created_at": datetime.now(UTC),
        # Activity from this moment on ticks tasks automatically. Replanning keeps it.
        "started_at": datetime.now(UTC),
    }
    await get_database().goal_plans.replace_one(_query(user), document, upsert=True)
    # The plan's courses join My courses; the first one becomes the current course.
    await user_service.include_subjects(user, courses, current=strategy.courses[0].subject_slug)
    plan = await get_plan(user, timezone)
    assert plan is not None
    return plan


async def replan(user: User, timezone: str) -> StudyPlanOut:
    """Rebuild the schedule from today with the accepted strategy and settings, from current progress."""
    document = await get_database().goal_plans.find_one(_query(user))
    if document is None:
        raise NotFoundError("You don't have a study plan yet.")
    settings = PlanSettings.model_validate(document["settings"])
    strategy = PlanStrategy.model_validate(document["strategy"])
    days = await _stored_days(user, document["courses"], strategy, settings, _today(timezone))
    await get_database().goal_plans.update_one(
        {"_id": document["_id"]}, {"$set": {"days": days, "created_at": datetime.now(UTC)}}
    )
    plan = await get_plan(user, timezone)
    assert plan is not None
    return plan


async def set_task_done(user: User, task_id: str, done: bool, timezone: str) -> StudyPlanOut:
    result = await get_database().goal_plans.update_one(
        {**_query(user), "days.tasks.id": task_id},
        {"$set": {"days.$[].tasks.$[task].done": done}},
        array_filters=[{"task.id": task_id}],
    )
    if result.matched_count == 0:
        raise NotFoundError("Task not found in your study plan.")
    plan = await get_plan(user, timezone)
    assert plan is not None
    return plan


async def delete_plan(user: User) -> None:
    """The plan goes; its courses stay in My courses with all their progress."""
    await get_database().goal_plans.delete_one(_query(user))


async def get_plan(user: User, timezone: str) -> StudyPlanOut | None:
    document = await get_database().goal_plans.find_one(_query(user))
    if document is None:
        return None
    today = _today(timezone)
    settings = PlanSettings.model_validate(document["settings"])
    strategy = PlanStrategy.model_validate(document["strategy"])
    pictures = await _course_pictures(user, document["courses"])
    names = {slug: progress.subject_name for slug, progress in pictures.items()}
    passed_topics = {t.topic_slug for p in pictures.values() for t in p.topics if t.final_test_passed}
    passed_exams = {slug for slug, p in pictures.items() if p.course_exam_passed}
    activity = await _activity_since(user.id, document.get("started_at", document["created_at"]))

    def is_auto_done(task: dict) -> bool:
        """Tasks tick themselves from what the learner actually did since the plan started."""
        topic, kind = task["topic_slug"], task["type"]
        if kind == "final_test":
            return topic in passed_topics
        if kind == "course_exam":
            return task["subject_slug"] in passed_exams
        if kind == "read":
            return topic in activity.read_topics
        if kind == "learn":
            return activity.learn_messages.get(topic, 0) > 0
        if kind == "practice":
            return activity.practice_answers.get(topic, 0) >= QUESTIONS_PER_PRACTICE * task.get("sequence", 1)
        if kind == "quiz":
            return activity.quiz_answers.get(topic, 0) >= QUIZ_QUESTIONS
        return False

    days = []
    for day in document["days"]:
        tasks = [
            PlanTask(
                **{
                    **task,
                    "subject_name": names[task["subject_slug"]],
                    "done": task["done"] or is_auto_done(task),
                    "auto_done": is_auto_done(task),
                }
            )
            for task in day["tasks"]
            if task["subject_slug"] in names
        ]
        if tasks:
            days.append(PlanDay(date=date.fromisoformat(day["date"]), tasks=tasks))

    all_tasks = [task for day in days for task in day.tasks]
    finish = days[-1].date if days else None
    details = _course_details(strategy, pictures)
    phase_input = [
        (day.date, [TaskDraft(t.subject_slug, t.type, t.topic_slug, t.title, t.detail, t.minutes) for t in day.tasks])
        for day in days
    ]
    first_day = days[0].date if days else today
    return StudyPlanOut(
        goal=document["goal"],
        level=document["level"],
        settings=settings,
        strategy=strategy,
        course_details=details,
        # The goal's progress is the courses' real completion, including work done before the plan.
        goal_progress=round(sum(c.completion_percent for c in details) / len(details)) if details else 0,
        phases=summarize_phases(phase_input, names, first_day),
        created_at=document["created_at"],
        today=today,
        days=days,
        total_tasks=len(all_tasks),
        done_tasks=sum(task.done for task in all_tasks),
        fits=finish is None or settings.target_date is None or finish <= settings.target_date,
        estimated_finish=finish,
        overdue_tasks=sum(1 for day in days if day.date < today for task in day.tasks if not task.done),
    )