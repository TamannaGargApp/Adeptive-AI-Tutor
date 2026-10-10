"""Personalized feedback: an AI "coach report" built from the learner's real answers and progress.

Reports are stored, and a new one is generated only when the learner has answered more questions
since the last report, so refreshing doesn't spend AI quota for nothing.
"""

from datetime import UTC, datetime

from app.core.exceptions import AppError
from app.db.mongodb import get_database, to_object_id
from app.models.enums import describe_goal
from app.models.user import User
from app.prompts.tutor_prompt import build_feedback_prompt, subject_rules
from app.schemas.feedback import FeedbackReportOut, FeedbackResponse
from app.services import progress_service, subject_service, topic_service
from app.services.ai_service import StructuredLLM

MIN_ANSWERS_FOR_FEEDBACK = 5
RECENT_MISTAKES_SHOWN = 20
MAX_TEXT = 200


async def get_latest_report(user: User, subject_slug: str) -> FeedbackReportOut | None:
    document = await get_database().feedback_reports.find_one(
        {"user_id": user.id, "subject_slug": subject_slug}, sort=[("created_at", -1)]
    )
    if document is None:
        return None
    answers_now = await _count_answers(user.id, subject_slug)
    return _to_out(document, can_refresh=answers_now > document["based_on_answers"])


async def generate_report(user: User, subject_slug: str, ai: StructuredLLM) -> FeedbackReportOut:
    latest = await get_latest_report(user, subject_slug)
    if latest and not latest.can_refresh:
        return latest  # Nothing new to analyse.

    answers = await _count_answers(user.id, subject_slug)
    if answers < MIN_ANSWERS_FOR_FEEDBACK:
        raise AppError(
            f"Answer at least {MIN_ANSWERS_FOR_FEEDBACK} questions in this course to get personalized feedback."
        )

    subject = await subject_service.get_subject(subject_slug)
    evidence = await _build_evidence(user, subject_slug)
    report = await ai.generate_structured(
        system_prompt=subject_rules(subject.name, subject.code_guidelines),
        user_prompt=build_feedback_prompt(
            subject.name, user.name, user.level or "beginner", describe_goal(user.goal), evidence
        ),
        response_model=FeedbackResponse,
    )
    document = {
        "user_id": user.id,
        "subject_slug": subject_slug,
        "report": report.model_dump(),
        "based_on_answers": answers,
        "created_at": datetime.now(UTC),
    }
    await get_database().feedback_reports.insert_one(document)
    return _to_out(document, can_refresh=False)


def _to_out(document: dict, can_refresh: bool) -> FeedbackReportOut:
    return FeedbackReportOut(
        subject_slug=document["subject_slug"],
        report=FeedbackResponse.model_validate(document["report"]),
        created_at=document["created_at"],
        based_on_answers=document["based_on_answers"],
        can_refresh=can_refresh,
    )


async def _topic_slugs(subject_slug: str) -> list[str]:
    return [topic.slug for topic in await topic_service.list_topics(subject_slug)]


async def _count_answers(user_id: str, subject_slug: str) -> int:
    return await get_database().attempts.count_documents(
        {"user_id": user_id, "topic_slug": {"$in": await _topic_slugs(subject_slug)}}
    )


def _clip(text: str) -> str:
    text = " ".join(text.split())
    return text if len(text) <= MAX_TEXT else text[: MAX_TEXT - 1] + "…"


async def _build_evidence(user: User, subject_slug: str) -> str:
    """A compact, factual summary of the learner's progress and recent mistakes for the prompt."""
    overall = await progress_service.get_overall_progress(user, subject_slug)
    topic_lines = [
        f"- {topic.topic_name}: {topic.completion_percent}% complete, accuracy {topic.accuracy}% over "
        f"{topic.questions_attempted} questions, difficulty {topic.current_difficulty.value}"
        + (f", weak concepts: {', '.join(topic.weaknesses)}" if topic.weaknesses else "")
        + (f", strong concepts: {', '.join(topic.strengths)}" if topic.strengths else "")
        for topic in overall.topics
        if topic.questions_attempted > 0
    ]

    db = get_database()
    mistakes = []
    cursor = (
        db.attempts.find({"user_id": user.id, "topic_slug": {"$in": await _topic_slugs(subject_slug)}, "correct": False})
        .sort("created_at", -1)
        .limit(RECENT_MISTAKES_SHOWN)
    )
    async for attempt in cursor:
        question = await db.questions.find_one({"_id": to_object_id(attempt["question_id"])})
        if question:
            mistakes.append(
                f"- [{attempt['topic_slug']} / {attempt.get('concept', '')}] Q: {_clip(question['prompt'])} | "
                f"learner answered: {_clip(attempt['answer'] or '(no answer)')} | correct: {_clip(question['correct_answer'])}"
            )

    return (
        f"Course progress: {overall.completion_percent}% complete, overall first-try accuracy {overall.accuracy}% "
        f"over {overall.questions_attempted} questions.\n\n"
        "Topics studied:\n" + ("\n".join(topic_lines) or "- none yet") + "\n\n"
        "Most recent wrong answers (newest first):\n" + ("\n".join(mistakes) or "- none")
    )