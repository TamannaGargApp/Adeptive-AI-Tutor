"""Daily streaks, XP levels, badges and activity history.

Everything is calculated from data the app already stores (answers in `attempts`, Learn messages in
`sessions`, test results in `topic_progress` / `course_progress`), so there is nothing extra to keep
in sync, and learners get credit for activity from before this feature existed.
Only earned badges are stored (`user_badges`), so a badge stays earned and keeps its unlock date.

Days are counted in the learner's timezone, sent by the browser, so a late-evening session counts
for the right day.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pymongo.errors import DuplicateKeyError

from app.db.mongodb import get_database
from app.models.progress import TopicProgress
from app.models.user import User
from app.schemas.gamification import (
    ActivityDay,
    ActivityHistory,
    Badge,
    GamificationOut,
    Level,
    Streak,
    StreakDay,
)
from app.services import progress_service, subject_service, topic_service

DEFAULT_TIMEZONE = "UTC"
CALENDAR_DAYS = 30
MAX_HISTORY_DAYS = 90

# XP rewards.
XP_CORRECT_FIRST_ATTEMPT = 10
XP_OTHER_ATTEMPT = 2
XP_LEARN_MESSAGE = 3
XP_TOPIC_TEST_PASSED = 50
XP_COURSE_EXAM_PASSED = 200
# Reaching level L needs LEVEL_STEP * L * (L - 1) / 2 XP in total: 100 for level 2, 300 for 3, 600 for 4…
LEVEL_STEP = 100


@dataclass
class DayCounts:
    questions: int = 0
    correct: int = 0
    attempts: int = 0
    learn_messages: int = 0

    @property
    def active(self) -> bool:
        return self.attempts > 0 or self.learn_messages > 0

    @property
    def xp(self) -> int:
        return (
            self.correct * XP_CORRECT_FIRST_ATTEMPT
            + (self.attempts - self.correct) * XP_OTHER_ATTEMPT
            + self.learn_messages * XP_LEARN_MESSAGE
        )


@dataclass
class LearnerStats:
    questions: int
    correct: int
    learn_messages: int
    longest_streak: int
    tests_passed: int
    perfect_tests: int
    topics_completed: int
    courses_completed: int
    courses_in_plan: int
    level: int


@dataclass(frozen=True)
class BadgeRule:
    id: str
    name: str
    description: str
    icon: str
    target: int
    metric: Callable[[LearnerStats], int]


BADGES: list[BadgeRule] = [
    BadgeRule("first_answer", "First steps", "Answer your first question.", "🌱", 1, lambda s: s.questions),
    BadgeRule("curious_mind", "Curious mind", "Send 10 messages in Learn mode.", "💬", 10, lambda s: s.learn_messages),
    BadgeRule("sharp_shooter", "Sharp shooter", "Get 50 answers right on the first try.", "🎯", 50, lambda s: s.correct),
    BadgeRule("century", "Century", "Answer 100 questions.", "💯", 100, lambda s: s.questions),
    BadgeRule("streak_3", "On a roll", "Learn 3 days in a row.", "🔥", 3, lambda s: s.longest_streak),
    BadgeRule("streak_7", "Week warrior", "Learn 7 days in a row.", "⚡", 7, lambda s: s.longest_streak),
    BadgeRule("streak_30", "Unstoppable", "Learn 30 days in a row.", "🏆", 30, lambda s: s.longest_streak),
    BadgeRule("test_taker", "Test taker", "Pass a topic final test.", "📝", 1, lambda s: s.tests_passed),
    BadgeRule("perfectionist", "Perfectionist", "Score 100% on a final test or course exam.", "⭐", 1, lambda s: s.perfect_tests),
    BadgeRule("topic_master", "Topic master", "Complete a topic.", "✅", 1, lambda s: s.topics_completed),
    BadgeRule("halfway_hero", "Halfway hero", "Complete 5 topics.", "🧭", 5, lambda s: s.topics_completed),
    BadgeRule("graduate", "Graduate", "Complete a course by passing its course exam.", "🎓", 1, lambda s: s.courses_completed),
    BadgeRule("polyglot", "Polyglot", "Add a second course to your plan.", "🌍", 2, lambda s: s.courses_in_plan),
    BadgeRule("rising_star", "Rising star", "Reach level 5.", "🚀", 5, lambda s: s.level),
]


# ---------- Pure calculations ----------


def resolve_timezone(name: str | None) -> str:
    """Use the browser's timezone if it's a valid IANA name (e.g. "Asia/Kolkata"), else UTC."""
    if not name:
        return DEFAULT_TIMEZONE
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return DEFAULT_TIMEZONE
    return name


def today_in(timezone: str) -> date:
    return datetime.now(ZoneInfo(timezone)).date()


def calculate_streaks(active_days: set[date], today: date) -> tuple[int, int]:
    """Return (current, longest). A streak stays alive until a full day passes with no activity."""
    yesterday = today - timedelta(days=1)
    start = today if today in active_days else yesterday if yesterday in active_days else None
    current = 0
    if start is not None:
        day = start
        while day in active_days:
            current += 1
            day -= timedelta(days=1)

    longest = run = 0
    previous: date | None = None
    for day in sorted(active_days):
        run = run + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        longest = max(longest, run)
        previous = day
    return current, max(longest, current)


def level_for_xp(total_xp: int) -> Level:
    level = 1
    while total_xp >= xp_to_reach(level + 1):
        level += 1
    start = xp_to_reach(level)
    return Level(
        level=level,
        total_xp=total_xp,
        xp_into_level=total_xp - start,
        xp_for_next_level=xp_to_reach(level + 1) - start,
    )


def xp_to_reach(level: int) -> int:
    return LEVEL_STEP * level * (level - 1) // 2


# ---------- Reading activity ----------


async def get_daily_counts(user_id: str, timezone: str) -> dict[date, DayCounts]:
    db = get_database()
    days: dict[date, DayCounts] = {}

    # Mongo converts each timestamp to the learner's local date.
    local_day = {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": timezone}}
    attempts = await db.attempts.aggregate(
        [
            {"$match": {"user_id": user_id}},
            {
                "$group": {
                    "_id": local_day,
                    "attempts": {"$sum": 1},
                    # Progress counts only first attempts; retries still earn a little XP.
                    "questions": {"$sum": {"$cond": ["$counted_in_progress", 1, 0]}},
                    "correct": {"$sum": {"$cond": [{"$and": ["$counted_in_progress", "$correct"]}, 1, 0]}},
                }
            },
        ]
    )
    async for row in attempts:
        counts = days.setdefault(date.fromisoformat(row["_id"]), DayCounts())
        counts.attempts, counts.questions, counts.correct = row["attempts"], row["questions"], row["correct"]

    messages = await db.sessions.aggregate(
        [
            {"$match": {"user_id": user_id, "mode": "learn"}},
            {"$unwind": "$messages"},
            {"$match": {"messages.role": "student"}},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$messages.created_at", "timezone": timezone}},
                    "count": {"$sum": 1},
                }
            },
        ]
    )
    async for row in messages:
        days.setdefault(date.fromisoformat(row["_id"]), DayCounts()).learn_messages = row["count"]
    return days


async def get_activity_history(user: User, timezone: str, days: int) -> ActivityHistory:
    timezone = resolve_timezone(timezone)
    days = max(1, min(days, MAX_HISTORY_DAYS))
    counts = await get_daily_counts(user.id, timezone)
    today = today_in(timezone)

    history = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        day_counts = counts.get(day, DayCounts())
        history.append(
            ActivityDay(
                date=day,
                questions=day_counts.questions,
                correct=day_counts.correct,
                accuracy=progress_service.calculate_accuracy(day_counts.correct, day_counts.questions)
                if day_counts.questions
                else None,
                learn_messages=day_counts.learn_messages,
                xp=day_counts.xp,
            )
        )
    return ActivityHistory(timezone=timezone, days=history)


# ---------- Summary: streak, level and badges ----------


async def get_summary(user: User, timezone: str) -> GamificationOut:
    timezone = resolve_timezone(timezone)
    counts = await get_daily_counts(user.id, timezone)
    today = today_in(timezone)
    active_days = {day for day, day_counts in counts.items() if day_counts.active}
    current, longest = calculate_streaks(active_days, today)

    test_stats = await _test_stats(user.id)
    total_xp = (
        sum(day_counts.xp for day_counts in counts.values())
        + test_stats["tests_passed"] * XP_TOPIC_TEST_PASSED
        + test_stats["courses_completed"] * XP_COURSE_EXAM_PASSED
    )
    level = level_for_xp(total_xp)

    stats = LearnerStats(
        questions=sum(day_counts.questions for day_counts in counts.values()),
        correct=sum(day_counts.correct for day_counts in counts.values()),
        learn_messages=sum(day_counts.learn_messages for day_counts in counts.values()),
        longest_streak=longest,
        tests_passed=test_stats["tests_passed"],
        perfect_tests=test_stats["perfect_tests"],
        topics_completed=test_stats["topics_completed"],
        courses_completed=test_stats["courses_completed"],
        courses_in_plan=len(subject_service.plan_subjects(user)),
        level=level.level,
    )
    badges, newly_earned = await _evaluate_badges(user.id, stats)

    return GamificationOut(
        streak=Streak(
            current=current,
            longest=longest,
            active_today=today in active_days,
            recent_days=[
                StreakDay(date=day, active=day in active_days)
                for day in (today - timedelta(days=offset) for offset in range(CALENDAR_DAYS - 1, -1, -1))
            ],
        ),
        level=level,
        badges=badges,
        newly_earned=newly_earned,
    )


async def _test_stats(user_id: str) -> dict[str, int]:
    db = get_database()
    topics = {topic.slug: topic for topic in await topic_service.list_all_topics()}
    tests_passed = perfect_tests = topics_completed = 0
    async for document in db.topic_progress.find({"user_id": user_id}):
        progress = TopicProgress.from_document(document)
        tests_passed += int(progress.final_test_passed)
        perfect_tests += int((progress.best_final_test_accuracy or 0) >= 100)
        topic = topics.get(progress.topic_slug)
        if topic and progress_service.calculate_completion(topic, progress).completed:
            topics_completed += 1

    courses_completed = 0
    async for document in db.course_progress.find({"user_id": user_id}):
        courses_completed += int(bool(document.get("exam_passed")))
        perfect_tests += int((document.get("best_exam_accuracy") or 0) >= 100)

    return {
        "tests_passed": tests_passed,
        "perfect_tests": perfect_tests,
        "topics_completed": topics_completed,
        "courses_completed": courses_completed,
    }


async def _evaluate_badges(user_id: str, stats: LearnerStats) -> tuple[list[Badge], list[str]]:
    db = get_database()
    earned_at = {
        document["badge_id"]: document["earned_at"] async for document in db.user_badges.find({"user_id": user_id})
    }

    newly_earned: list[str] = []
    now = datetime.now(UTC)
    for rule in BADGES:
        if rule.id not in earned_at and rule.metric(stats) >= rule.target:
            try:
                await db.user_badges.insert_one({"user_id": user_id, "badge_id": rule.id, "earned_at": now})
                newly_earned.append(rule.id)
            except DuplicateKeyError:
                pass  # Another request recorded it at the same moment.
            earned_at[rule.id] = now

    badges = [
        Badge(
            id=rule.id,
            name=rule.name,
            description=rule.description,
            icon=rule.icon,
            earned=rule.id in earned_at,
            earned_at=earned_at.get(rule.id),
            progress=rule.target if rule.id in earned_at else min(rule.metric(stats), rule.target),
            target=rule.target,
        )
        for rule in BADGES
    ]
    return badges, newly_earned