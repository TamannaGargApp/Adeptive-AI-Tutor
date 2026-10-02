"""Progress tracking, mastery, topic completion and adaptive difficulty.

Only the first attempt at each question counts toward accuracy. Retries after a hint are still
saved in `attempts`, but counting them would let a learner raise accuracy by guessing until right.
"""

from dataclasses import dataclass
from datetime import UTC, datetime

from app.db.mongodb import get_database
from app.models.enums import DIFFICULTY_ORDER, CompletionStatus, LearningMode, Level, Mastery
from app.models.progress import ConceptStat, TopicProgress
from app.models.question import Question
from app.models.topic import Topic
from app.models.user import User
from app.schemas.progress import CompletionRequirement, OverallProgress, TopicProgressOut
from app.services import topic_service

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
# A topic is 100% complete when all three requirements are met:
#   1. Practice:  at least 10 questions answered (first attempts, practice or quiz).
#   2. Accuracy:  at least 9 of the last 10 answers correct (90%).
#   3. Coverage:  every key concept of the topic answered correctly at least once.
# Each requirement contributes a share of the percentage, so partial progress is visible.
# The percentage never shows 100 until every requirement is fully met.

MIN_QUESTIONS_FOR_COMPLETION = 10
RECENT_WINDOW = 10
REQUIRED_RECENT_CORRECT = 9
QUESTIONS_WEIGHT = 20
ACCURACY_WEIGHT = 40
CONCEPTS_WEIGHT = 40
ALMOST_COMPLETE_FROM_PERCENT = 75
# Below this share of recent answers correct (after a few answers), the topic needs more practice.
NEEDS_PRACTICE_BELOW = 0.5
MIN_ANSWERS_TO_JUDGE = 3
MAX_CONCEPTS_IN_REMARK = 3


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

    completed = (
        attempted >= MIN_QUESTIONS_FOR_COMPLETION
        and recent_correct >= REQUIRED_RECENT_CORRECT
        and not remaining
    )
    percent = round(
        QUESTIONS_WEIGHT * questions_share + ACCURACY_WEIGHT * accuracy_share + CONCEPTS_WEIGHT * concepts_share
    )
    if not completed:
        percent = min(percent, 99)

    status = _completion_status(attempted, recent, percent, completed)
    return TopicCompletion(
        percent=percent,
        status=status,
        completed=completed,
        remarks=_completion_remarks(status, attempted, recent, remaining),
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
        ],
        concepts_covered=covered,
        concepts_remaining=remaining,
        recent_correct=recent_correct,
        recent_answered=len(recent),
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
    status: CompletionStatus, attempted: int, recent: list[bool], remaining: list[str]
) -> list[str]:
    """Short, specific notes on what's left, most important first."""
    if status == CompletionStatus.NOT_STARTED:
        return ["Not started yet. Begin with a Learn session, then try some practice questions."]
    if status == CompletionStatus.COMPLETE:
        return ["Topic complete! Take a quiz at a harder difficulty to keep it sharp."]

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
    )


async def get_overall_progress(user: User) -> OverallProgress:
    topics = await topic_service.list_topics()
    progress_by_slug = await get_progress_by_topic(user.id)
    fallback = default_difficulty(user)

    topic_items = [to_topic_progress_out(topic, progress_by_slug.get(topic.slug), fallback) for topic in topics]
    attempted = sum(item.questions_attempted for item in topic_items)
    correct = sum(item.correct_answers for item in topic_items)
    average_completion = (
        round(sum(item.completion_percent for item in topic_items) / len(topic_items)) if topic_items else 0
    )
    return OverallProgress(
        questions_attempted=attempted,
        correct_answers=correct,
        accuracy=calculate_accuracy(correct, attempted),
        completion_percent=average_completion,
        topics_completed=sum(item.completed for item in topic_items),
        topics=topic_items,
    )


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


async def _save_topic_progress(progress: TopicProgress) -> None:
    document = progress.model_dump(mode="python", exclude={"id"})
    document["mastery"] = progress.mastery.value
    document["current_difficulty"] = progress.current_difficulty.value
    await get_database().topic_progress.replace_one(
        {"user_id": progress.user_id, "topic_slug": progress.topic_slug}, document, upsert=True
    )