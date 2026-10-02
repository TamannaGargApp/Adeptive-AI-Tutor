from datetime import UTC, datetime

from app.core.exceptions import NotFoundError
from app.db.mongodb import get_database, to_object_id
from app.models.question import Question
from app.models.session import LearningSession
from app.schemas.tutor import QuestionResponse


async def save_questions(session: LearningSession, generated: list[QuestionResponse]) -> list[Question]:
    now = datetime.now(UTC)
    documents = [
        {
            **item.model_dump(),
            "user_id": session.user_id,
            "session_id": session.id,
            "topic_slug": session.topic_slug,
            "mode": session.mode.value,
            "difficulty": session.difficulty.value,
            "attempt_count": 0,
            "solved": False,
            "created_at": now,
        }
        for item in generated
    ]
    result = await get_database().questions.insert_many(documents)
    for document, inserted_id in zip(documents, result.inserted_ids, strict=True):
        document["_id"] = inserted_id
    return [Question.from_document(document) for document in documents]


async def get_question(user_id: str, question_id: str) -> Question:
    object_id = to_object_id(question_id)
    document = None
    if object_id is not None:
        document = await get_database().questions.find_one({"_id": object_id, "user_id": user_id})
    if document is None:
        raise NotFoundError("Question not found.")
    return Question.from_document(document)


async def get_questions(user_id: str, question_ids: list[str]) -> list[Question]:
    object_ids = [oid for oid in (to_object_id(qid) for qid in question_ids) if oid is not None]
    cursor = get_database().questions.find({"_id": {"$in": object_ids}, "user_id": user_id})
    by_id = {str(document["_id"]): Question.from_document(document) async for document in cursor}
    return [by_id[qid] for qid in question_ids if qid in by_id]


async def record_question_attempt(question_id: str, correct: bool) -> None:
    update: dict = {"$inc": {"attempt_count": 1}}
    if correct:
        update["$set"] = {"solved": True}
    await get_database().questions.update_one({"_id": to_object_id(question_id)}, update)


async def get_recent_prompts(user_id: str, topic_slug: str, limit: int = 10) -> list[str]:
    """Recent questions for this topic, passed to the AI so it avoids repeating itself."""
    cursor = (
        get_database()
        .questions.find({"user_id": user_id, "topic_slug": topic_slug}, {"prompt": 1})
        .sort("created_at", -1)
        .limit(limit)
    )
    return [document["prompt"] async for document in cursor]
