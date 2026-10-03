"""Progress tracking, mastery, topic completion and adaptive difficulty.

Only the first attempt at each question counts toward accuracy. Retries after a hint are still
saved in `attempts`, but counting them would let a learner raise accuracy by guessing until right.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.db.mongodb import get_database
from app.models.enums import DIFFICULTY_ORDER, CompletionStatus, LearningMode, Level, Mastery
from app.models.progress import ConceptStat, CourseProgress, TopicProgress
from app.models.question import Question
from app.models.topic import Topic
from app.models.user import User
from app.schemas.progress import CompletionRequirement, OverallProgress, TopicProgressOut
from app.services import subject_service, topic_service

RECENT_RESULTS_KEPT = 10
DIFFICULTY_WINDOW = 3
STRENGTH_THRESHOLD = 0.75
WEAKNESS_THRESHOLD = 0.5
MAX_LISTED_CONCEPTS = 5


@dataclass
class ProgressUpdate:
    next_difficulty: Level
    difficulty_changed: bool


# ---------- Pure calculations (easy to unit test) ----------


def calculate_accuracy(correct: int, attempted: int) -> float:
    if attempted <= 0:
        return 0.0
    return round(correct / attempted * 100, 1)


def mastery_for(accuracy: float, attempted: int) -> Mastery:
    if attempted == 0:
        return Mastery.NOT_STARTED
    if accuracy >= 90:
        return Mastery.MASTERED
    if accuracy >= 75:
        return Mastery.STRONG
    if accuracy >= 50:
        return Mastery.DEVELOPING
    return Mastery.NEEDS_PRACTICE


def adjust_difficulty(current: Level, recent_results: list[bool]) -> Level:
    """Move up after 3 correct in a row; move down after 2 misses in the last 3."""
    if len(recent_results) < DIFFICULTY_WINDOW:
        return current
    window = recent_results[-DIFFICULTY_WINDOW:]
    index = DIFFICULTY_ORDER.index(current)
    if all(window):
        return DIFFICULTY_ORDER[min(index + 1, len(DIFFICULTY_ORDER) - 1)]
    if window.count(False) >= 2:
        return DIFFICULTY_ORDER[max(index - 1, 0)]
    return current


def find_strengths_and_weaknesses(concept_stats: list[ConceptStat]) -> tuple[list[str], list[str]]:
    rated = [(stat.concept, stat.correct / stat.attempted) for stat in concept_stats if stat.attempted > 0]
    strengths = [concept for concept, ratio in sorted(rated, key=lambda item: -item[1]) if ratio >= STRENGTH_THRESHOLD]
    weaknesses = [concept for concept, ratio in sorted(rated, key=lambda item: item[1]) if ratio < WEAKNESS_THRESHOLD]
    return strengths[:MAX_LISTED_CONCEPTS], weaknesses[:MAX_LISTED_CONCEPTS]


def update_concept_stats(stats: list[ConceptStat], concept: str, correct: bool) -> list[ConceptStat]:
    key = concept.strip().lower()
    updated = [stat.model_copy() for stat in stats]
    for stat in updated:
        if stat.concept.lower() == key:
            stat.attempted += 1
            stat.correct += int(correct)
            return updated
    updated.append(ConceptStat(concept=concept.strip(), attempted=1, correct=int(correct)))
    return updated


# ---------- Topic completion standard ----------
#
# A topic is 100% complete when all four requirements are met:
#   1. Practice:    at least 10 questions answered (first attempts in practice, quizzes or tests).
#   2. Accuracy:    at least 9 of the last 10 answers correct (90%).
#   3. Coverage:    every key concept of the topic answered correctly at least once.
#   4. Final test:  the topic's final test passed with at least FINAL_TEST_PASS_MARK.
# Each requirement contributes a share of the percentage, so partial progress is visible.
# The percentage never shows 100 until every requirement is fully met.
#
# A course is complete when every topic is complete AND its course exam is passed.
# The course exam stays locked until every topic is complete.

MIN_QUESTIONS_FOR_COMPLETION = 10
RECENT_WINDOW = 10
REQUIRED_RECENT_CORRECT = 9
# Pass mark (accuracy %) for both topic final tests and course exams.
FINAL_TEST_PASS_MARK = 70.0
# After passing a topic's final test, the learner may take this many new attempts. Before passing
# there is no limit, so failing attempts can never lock a learner out of completing a topic.
MAX_ATTEMPTS_AFTER_PASS = 2
# Failing rules. Below the pass mark is a fail.
# - Topic test: this many failed attempts in a row lock it for RETRY_COOLDOWN.
# - Course exam: every failed attempt locks it for RETRY_COOLDOWN.
FAILS_BEFORE_COOLDOWN = 3
RETRY_COOLDOWN = timedelta(hours=12)
QUESTIONS_WEIGHT = 20
ACCURACY_WEIGHT = 30
CONCEPTS_WEIGHT = 30
FINAL_TEST_WEIGHT = 20
# Share of the course percentage that comes from topics; the rest comes from passing the course exam.
COURSE_TOPICS_SHARE = 0.9
ALMOST_COMPLETE_FROM_PERCENT = 75
# Below this share of recent answers correct (after a few answers), the topic needs more practice.
NEEDS_PRACTICE_BELOW = 0.5
MIN_ANSWERS_TO_JUDGE = 3
MAX_CONCEPTS_IN_REMARK = 3
MAX_TOPICS_IN_REMARK = 3


@dataclass
class TopicCompletion:
    percent: int
    status: CompletionStatus
    completed: bool
    remarks: list[str]
    requirements: list[CompletionRequirement]
    concepts_covered: list[str]
    concepts_remaining: list[str]
    recent_correct: int
    recent_answered: int
    final_test_passed: bool
    final_test_best: float | None
    ready_for_final_test: bool


def _normalize_concept(concept: str) -> str:
    return " ".join(concept.lower().split())


def match_key_concept(concept: str, key_concepts: list[str]) -> str | None:
    """Map a concept name from the AI onto one of the topic's key concepts, if it clearly is one."""
    normalized = _normalize_concept(concept)
    if not normalized:
        return None
    for key in key_concepts:
        if _normalize_concept(key) == normalized:
            return key
    for key in key_concepts:
        key_normalized = _normalize_concept(key)
        if key_normalized in normalized or normalized in key_normalized:
            return key
    return None


def covered_key_concepts(key_concepts: list[str], concept_stats: list[ConceptStat]) -> list[str]:
    """Key concepts answered correctly at least once, in the topic's own order."""
    covered = {
        match_key_concept(stat.concept, key_concepts) for stat in concept_stats if stat.correct > 0
    }
    return [concept for concept in key_concepts if concept in covered]


def calculate_completion(topic: Topic, progress: TopicProgress | None) -> TopicCompletion:
    attempted = progress.questions_attempted if progress else 0
    recent = progress.last_answers[-RECENT_WINDOW:] if progress else []
    recent_correct = sum(recent)
    covered = covered_key_concepts(topic.key_concepts, progress.concept_stats if progress else [])
    remaining = [concept for concept in topic.key_concepts if concept not in covered]

    questions_share = min(attempted, MIN_QUESTIONS_FOR_COMPLETION) / MIN_QUESTIONS_FOR_COMPLETION
    accuracy_share = min(recent_correct, REQUIRED_RECENT_CORRECT) / REQUIRED_RECENT_CORRECT
    concepts_share = len(covered) / len(topic.key_concepts) if topic.key_concepts else 1.0

    test_passed = bool(progress and progress.final_test_passed)
    best_test = progress.best_final_test_accuracy if progress else None
    # "Ready" means everything except the final test is done.
    practice_done = (
        attempted >= MIN_QUESTIONS_FOR_COMPLETION and recent_correct >= REQUIRED_RECENT_CORRECT and not remaining
    )
    completed = practice_done and test_passed
    percent = round(
        QUESTIONS_WEIGHT * questions_share
        + ACCURACY_WEIGHT * accuracy_share
        + CONCEPTS_WEIGHT * concepts_share
        + FINAL_TEST_WEIGHT * test_passed
    )
    if not completed:
        percent = min(percent, 99)

    status = _completion_status(attempted, recent, percent, completed)
    return TopicCompletion(
        percent=percent,
        status=status,
        completed=completed,
        remarks=_completion_remarks(status, attempted, recent, remaining, practice_done, best_test),
        requirements=[
            CompletionRequirement(
                label=f"Answer at least {MIN_QUESTIONS_FOR_COMPLETION} questions",
                met=attempted >= MIN_QUESTIONS_FOR_COMPLETION,
                progress=f"{min(attempted, MIN_QUESTIONS_FOR_COMPLETION)}/{MIN_QUESTIONS_FOR_COMPLETION}",
            ),
            CompletionRequirement(
                label=f"Get {REQUIRED_RECENT_CORRECT} of your last {RECENT_WINDOW} answers right",
                met=recent_correct >= REQUIRED_RECENT_CORRECT,
                progress=f"{min(recent_correct, REQUIRED_RECENT_CORRECT)}/{REQUIRED_RECENT_CORRECT}",
            ),
            CompletionRequirement(
                label="Answer every key concept correctly",
                met=not remaining,
                progress=f"{len(covered)}/{len(topic.key_concepts)}",
            ),
            CompletionRequirement(
                label=f"Pass the final test ({FINAL_TEST_PASS_MARK:.0f}% or more)",
                met=test_passed,
                progress="Not taken" if best_test is None else f"Best {best_test:.0f}%",
            ),
        ],
        concepts_covered=covered,
        concepts_remaining=remaining,
        recent_correct=recent_correct,
        recent_answered=len(recent),
        final_test_passed=test_passed,
        final_test_best=best_test,
        ready_for_final_test=practice_done and not test_passed,
    )


def _completion_status(attempted: int, recent: list[bool], percent: int, completed: bool) -> CompletionStatus:
    if attempted == 0:
        return CompletionStatus.NOT_STARTED
    if completed:
        return CompletionStatus.COMPLETE
    if len(recent) >= MIN_ANSWERS_TO_JUDGE and sum(recent) / len(recent) < NEEDS_PRACTICE_BELOW:
        return CompletionStatus.NEEDS_PRACTICE
    if percent >= ALMOST_COMPLETE_FROM_PERCENT:
        return CompletionStatus.ALMOST_COMPLETE
    return CompletionStatus.IN_PROGRESS


def _completion_remarks(
    status: CompletionStatus,
    attempted: int,
    recent: list[bool],
    remaining: list[str],
    practice_done: bool,
    best_test: float | None,
) -> list[str]:
    """Short, specific notes on what's left, most important first."""
    if status == CompletionStatus.NOT_STARTED:
        return ["Not started yet. Begin with a Learn session, then try some practice questions."]
    if status == CompletionStatus.COMPLETE:
        return ["Topic complete! Take a quiz at a harder difficulty to keep it sharp."]
    if practice_done:
        attempt_note = "" if best_test is None else f" Your best so far is {best_test:.0f}%."
        return [
            f"Ready for the final test! Score {FINAL_TEST_PASS_MARK:.0f}% or more to complete this topic.{attempt_note}"
        ]

    remarks: list[str] = []
    recent_correct = sum(recent)
    if status == CompletionStatus.NEEDS_PRACTICE:
        remarks.append(
            f"Needs more practice: {recent_correct} of your last {len(recent)} answers were correct. "
            "Review the topic in Learn mode, then practice again."
        )
    if attempted < MIN_QUESTIONS_FOR_COMPLETION:
        left = MIN_QUESTIONS_FOR_COMPLETION - attempted
        remarks.append(f"Answer {left} more question{'s' if left != 1 else ''} to reach the minimum of {MIN_QUESTIONS_FOR_COMPLETION}.")
    if recent_correct < REQUIRED_RECENT_CORRECT and status != CompletionStatus.NEEDS_PRACTICE:
        remarks.append(
            f"Get {REQUIRED_RECENT_CORRECT} of your last {RECENT_WINDOW} answers right "
            f"(currently {recent_correct} of {len(recent)})."
        )
    if remaining:
        listed = ", ".join(remaining[:MAX_CONCEPTS_IN_REMARK])
        extra = len(remaining) - MAX_CONCEPTS_IN_REMARK
        suffix = f" and {extra} more" if extra > 0 else ""
        remarks.append(f"Answer a question correctly on: {listed}{suffix}.")
    remarks.append(f"Then pass the topic's final test with {FINAL_TEST_PASS_MARK:.0f}% or more.")
    return remarks


# ---------- Database reads ----------


async def get_topic_progress(user_id: str, topic_slug: str) -> TopicProgress | None:
    document = await get_database().topic_progress.find_one({"user_id": user_id, "topic_slug": topic_slug})
    return TopicProgress.from_document(document) if document else None


async def get_progress_by_topic(user_id: str) -> dict[str, TopicProgress]:
    cursor = get_database().topic_progress.find({"user_id": user_id})
    return {document["topic_slug"]: TopicProgress.from_document(document) async for document in cursor}


def default_difficulty(user: User) -> Level:
    return user.preferred_difficulty or Level.BEGINNER


async def get_current_difficulty(user: User, topic_slug: str) -> Level:
    progress = await get_topic_progress(user.id, topic_slug)
    return progress.current_difficulty if progress else default_difficulty(user)


def to_topic_progress_out(topic: Topic, progress: TopicProgress | None, fallback: Level) -> TopicProgressOut:
    completion = calculate_completion(topic, progress)
    strengths, weaknesses = find_strengths_and_weaknesses(progress.concept_stats) if progress else ([], [])
    return TopicProgressOut(
        topic_slug=topic.slug,
        topic_name=topic.name,
        questions_attempted=progress.questions_attempted if progress else 0,
        correct_answers=progress.correct_answers if progress else 0,
        accuracy=progress.accuracy if progress else 0.0,
        mastery=progress.mastery if progress else Mastery.NOT_STARTED,
        current_difficulty=progress.current_difficulty if progress else fallback,
        strengths=strengths,
        weaknesses=weaknesses,
        last_attempted_at=progress.last_attempted_at if progress else None,
        completion_percent=completion.percent,
        completion_status=completion.status,
        completed=completion.completed,
        remarks=completion.remarks,
        requirements=completion.requirements,
        concepts_covered=completion.concepts_covered,
        concepts_remaining=completion.concepts_remaining,
        recent_correct=completion.recent_correct,
        recent_answered=completion.recent_answered,
        final_test_passed=completion.final_test_passed,
        final_test_best=completion.final_test_best,
        ready_for_final_test=completion.ready_for_final_test,
        final_test_attempts_left=final_test_attempts_left(progress),
        final_test_fails_in_row=progress.final_test_fails_in_row if progress else 0,
        final_test_locked_until=active_lock(progress.final_test_locked_until if progress else None),
    )


def active_lock(locked_until: datetime | None) -> datetime | None:
    """The lock time if it's still in the future, otherwise None."""
    return locked_until if locked_until and locked_until > datetime.now(UTC) else None


def final_test_attempts_left(progress: TopicProgress | None) -> int | None:
    if progress is None or not progress.final_test_passed:
        return None
    return max(0, MAX_ATTEMPTS_AFTER_PASS - progress.final_test_attempts_after_pass)


async def get_overall_progress(user: User, subject_slug: str) -> OverallProgress:
    """Progress across one course's topics."""
    subject = await subject_service.get_subject(subject_slug)
    topics = await topic_service.list_topics(subject_slug)
    progress_by_slug = await get_progress_by_topic(user.id)
    fallback = default_difficulty(user)

    topic_items = [to_topic_progress_out(topic, progress_by_slug.get(topic.slug), fallback) for topic in topics]
    attempted = sum(item.questions_attempted for item in topic_items)
    correct = sum(item.correct_answers for item in topic_items)
    average_completion = sum(item.completion_percent for item in topic_items) / len(topic_items) if topic_items else 0
    remaining = [item.topic_name for item in topic_items if not item.completed]
    exam = await get_course_progress(user.id, subject_slug)
    exam_passed = bool(exam and exam.exam_passed)
    course_completed = not remaining and exam_passed
    course_percent = round(average_completion * COURSE_TOPICS_SHARE + (100 - 100 * COURSE_TOPICS_SHARE) * exam_passed)
    if not course_completed:
        course_percent = min(course_percent, 99)

    return OverallProgress(
        subject_slug=subject.slug,
        subject_name=subject.name,
        questions_attempted=attempted,
        correct_answers=correct,
        accuracy=calculate_accuracy(correct, attempted),
        completion_percent=course_percent,
        topics_completed=sum(item.completed for item in topic_items),
        course_completed=course_completed,
        course_exam_unlocked=not remaining,
        course_exam_passed=exam_passed,
        course_exam_best=exam.best_exam_accuracy if exam else None,
        course_exam_locked_until=active_lock(exam.exam_locked_until) if exam and not exam_passed else None,
        topics_remaining=remaining,
        course_remarks=_course_remarks(subject.name, remaining, exam_passed, exam.best_exam_accuracy if exam else None),
        topics=topic_items,
    )


def _course_remarks(subject_name: str, remaining: list[str], exam_passed: bool, best: float | None) -> list[str]:
    if not remaining and exam_passed:
        return [f"Course complete! You passed the {subject_name} course exam."]
    if not remaining:
        attempt_note = "" if best is None else f" Your best so far is {best:.0f}%."
        return [
            f"Every topic is complete, so the course exam is unlocked. Score {FINAL_TEST_PASS_MARK:.0f}% or more "
            f"to complete the course.{attempt_note}"
        ]
    listed = ", ".join(remaining[:MAX_TOPICS_IN_REMARK])
    extra = len(remaining) - MAX_TOPICS_IN_REMARK
    suffix = f" and {extra} more" if extra > 0 else ""
    count = len(remaining)
    return [f"Complete {count} more topic{'s' if count != 1 else ''} to unlock the course exam: {listed}{suffix}."]


async def get_topic_progress_out(user: User, topic_slug: str) -> TopicProgressOut:
    topic = await topic_service.get_topic(topic_slug)
    progress = await get_topic_progress(user.id, topic_slug)
    return to_topic_progress_out(topic, progress, default_difficulty(user))


# ---------- Database writes ----------


async def record_attempt(
    user: User, question: Question, answer: str, correct: bool, score: int
) -> ProgressUpdate:
    is_first_attempt = question.attempt_count == 0
    now = datetime.now(UTC)
    await get_database().attempts.insert_one(
        {
            "user_id": user.id,
            "question_id": question.id,
            "session_id": question.session_id,
            "topic_slug": question.topic_slug,
            "mode": question.mode.value,
            "difficulty": question.difficulty.value,
            "concept": question.concept,
            "answer": answer,
            "correct": correct,
            "score": score,
            "attempt_number": question.attempt_count + 1,
            "counted_in_progress": is_first_attempt,
            "created_at": now,
        }
    )

    progress = await get_topic_progress(user.id, question.topic_slug)
    current = progress.current_difficulty if progress else question.difficulty
    if not is_first_attempt:
        return ProgressUpdate(next_difficulty=current, difficulty_changed=False)

    updated = _apply_result(progress, user, question, correct, now)
    await _save_topic_progress(updated)
    changed = question.mode == LearningMode.PRACTICE and updated.current_difficulty != question.difficulty
    return ProgressUpdate(next_difficulty=updated.current_difficulty, difficulty_changed=changed)


def _apply_result(
    progress: TopicProgress | None, user: User, question: Question, correct: bool, now: datetime
) -> TopicProgress:
    if progress is None:
        progress = TopicProgress(
            id="", user_id=user.id, topic_slug=question.topic_slug, current_difficulty=question.difficulty
        )

    attempted = progress.questions_attempted + 1
    correct_total = progress.correct_answers + int(correct)
    accuracy = calculate_accuracy(correct_total, attempted)
    recent = (progress.recent_results + [correct])[-RECENT_RESULTS_KEPT:]

    # Quiz questions are generated in one batch, so difficulty only adapts during practice.
    if question.mode == LearningMode.PRACTICE:
        next_difficulty = adjust_difficulty(question.difficulty, recent)
        if next_difficulty != question.difficulty:
            # Start a fresh streak at the new level so difficulty doesn't bounce back immediately.
            recent = []
    else:
        next_difficulty = progress.current_difficulty

    return progress.model_copy(
        update={
            "questions_attempted": attempted,
            "correct_answers": correct_total,
            "accuracy": accuracy,
            "mastery": mastery_for(accuracy, attempted),
            "current_difficulty": next_difficulty,
            "concept_stats": update_concept_stats(progress.concept_stats, question.concept, correct),
            "recent_results": recent,
            "last_answers": (progress.last_answers + [correct])[-RECENT_WINDOW:],
            "last_attempted_at": now,
        }
    )


@dataclass
class RetryState:
    """What a finished attempt means for the next one."""

    fails_in_row: int
    retry_available_at: datetime | None


async def record_final_test_result(user_id: str, topic_slug: str, accuracy: float) -> RetryState:
    """Keep the best score; passing once meets the requirement. Count failed attempts in a row
    (only before the first pass) and lock the test for a while after too many."""
    progress = await get_topic_progress(user_id, topic_slug)
    passed_now = accuracy >= FINAL_TEST_PASS_MARK
    already_passed = bool(progress and progress.final_test_passed)

    changes: dict = {}
    retry_at: datetime | None = None
    fails = 0
    if passed_now or already_passed:
        changes = {"final_test_passed": True, "final_test_fails_in_row": 0, "final_test_locked_until": None}
    else:
        fails = (progress.final_test_fails_in_row if progress else 0) + 1
        if fails >= FAILS_BEFORE_COOLDOWN:
            retry_at = datetime.now(UTC) + RETRY_COOLDOWN
            changes = {"final_test_fails_in_row": 0, "final_test_locked_until": retry_at}
        else:
            changes = {"final_test_fails_in_row": fails}

    await get_database().topic_progress.update_one(
        {"user_id": user_id, "topic_slug": topic_slug},
        {"$max": {"best_final_test_accuracy": accuracy}, "$set": changes},
    )
    return RetryState(fails_in_row=fails if retry_at is None else FAILS_BEFORE_COOLDOWN, retry_available_at=retry_at)


async def use_attempt_after_pass(user_id: str, topic_slug: str) -> None:
    await get_database().topic_progress.update_one(
        {"user_id": user_id, "topic_slug": topic_slug}, {"$inc": {"final_test_attempts_after_pass": 1}}
    )


async def get_course_progress(user_id: str, subject_slug: str) -> CourseProgress | None:
    document = await get_database().course_progress.find_one({"user_id": user_id, "subject_slug": subject_slug})
    return CourseProgress.from_document(document) if document else None


async def record_course_exam_result(user_id: str, subject_slug: str, accuracy: float) -> RetryState:
    """Keep the best score. A failed attempt locks the course exam for RETRY_COOLDOWN."""
    passed = accuracy >= FINAL_TEST_PASS_MARK
    retry_at = None if passed else datetime.now(UTC) + RETRY_COOLDOWN
    changes = {"exam_passed": True, "exam_locked_until": None} if passed else {"exam_locked_until": retry_at}
    await get_database().course_progress.update_one(
        {"user_id": user_id, "subject_slug": subject_slug},
        {"$max": {"best_exam_accuracy": accuracy}, "$inc": {"exam_attempts": 1}, "$set": changes},
        upsert=True,
    )
    return RetryState(fails_in_row=0 if passed else 1, retry_available_at=retry_at)


async def backfill_final_test_results() -> None:
    """Record best scores and passes from tests finished before results were stored on progress.

    Safe to run on every startup: it only ever raises a best score or marks a pass.
    """
    db = get_database()
    best_scores = await db.final_tests.aggregate(
        [
            {"$match": {"result": {"$ne": None}}},
            {
                "$group": {
                    "_id": {"user_id": "$user_id", "scope": "$scope", "topic": "$topic_slug", "subject": "$subject_slug"},
                    "best": {"$max": "$result.accuracy"},
                }
            },
        ]
    )
    async for row in best_scores:
        key, best = row["_id"], row["best"]
        passed = best >= FINAL_TEST_PASS_MARK
        if key.get("scope") == "course":
            update: dict = {"$max": {"best_exam_accuracy": best}}
            if passed:
                update["$set"] = {"exam_passed": True}
            # Tests created before multi-course support are all Python.
            subject = key.get("subject") or "python"
            await db.course_progress.update_one({"user_id": key["user_id"], "subject_slug": subject}, update, upsert=True)
        elif key.get("topic"):
            update = {"$max": {"best_final_test_accuracy": best}}
            if passed:
                update["$set"] = {"final_test_passed": True}
            await db.topic_progress.update_one({"user_id": key["user_id"], "topic_slug": key["topic"]}, update)


async def _save_topic_progress(progress: TopicProgress) -> None:
    document = progress.model_dump(mode="python", exclude={"id"})
    document["mastery"] = progress.mastery.value
    document["current_difficulty"] = progress.current_difficulty.value
    await get_database().topic_progress.replace_one(
        {"user_id": progress.user_id, "topic_slug": progress.topic_slug}, document, upsert=True
    )