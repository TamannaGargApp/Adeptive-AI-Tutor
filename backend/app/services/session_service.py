from datetime import UTC, datetime

from app.core.exceptions import AppError, NotFoundError
from app.db.mongodb import get_database, to_object_id
from app.models.enums import LearningMode, Level
from app.models.session import ChatMessage, LearningSession
from app.models.user import User
from app.schemas.session import SessionCreate
from app.services import progress_service, topic_service


async def create_session(user: User, data: SessionCreate) -> LearningSession:
    """Start a session, or continue the latest Learn conversation when `resume` is requested."""
    if data.mode == LearningMode.FINAL_TEST:
        raise AppError("Final tests are started from the final test page.")
    await topic_service.get_topic(data.topic_slug)

    if data.resume and data.mode == LearningMode.LEARN:
        latest = await get_latest_learn_session(user.id, data.topic_slug)
        if latest is not None:
            if data.difficulty and data.difficulty != latest.difficulty:
                await update_difficulty(latest.id, data.difficulty)
                latest = latest.model_copy(update={"difficulty": data.difficulty})
            return latest

    difficulty = data.difficulty or await progress_service.get_current_difficulty(user, data.topic_slug)

    now = datetime.now(UTC)
    document = {
        "user_id": user.id,
        "topic_slug": data.topic_slug,
        "mode": data.mode.value,
        "difficulty": difficulty.value,
        "messages": [],
        "quiz_question_ids": [],
        "created_at": now,
        "updated_at": now,
    }
    result = await get_database().sessions.insert_one(document)
    document["_id"] = result.inserted_id
    return LearningSession.from_document(document)


async def get_latest_learn_session(user_id: str, topic_slug: str) -> LearningSession | None:
    document = await get_database().sessions.find_one(
        {"user_id": user_id, "topic_slug": topic_slug, "mode": LearningMode.LEARN.value},
        sort=[("updated_at", -1)],
    )
    return LearningSession.from_document(document) if document else None


async def get_session(user_id: str, session_id: str) -> LearningSession:
    object_id = to_object_id(session_id)
    document = None
    if object_id is not None:
        document = await get_database().sessions.find_one({"_id": object_id, "user_id": user_id})
    if document is None:
        raise NotFoundError("Learning session not found.")
    return LearningSession.from_document(document)


async def get_session_in_mode(user_id: str, session_id: str, mode: LearningMode) -> LearningSession:
    session = await get_session(user_id, session_id)
    if session.mode != mode:
        raise AppError(f"This session is in {session.mode.value} mode, not {mode.value} mode.")
    return session


async def append_messages(session_id: str, messages: list[ChatMessage]) -> None:
    await get_database().sessions.update_one(
        {"_id": to_object_id(session_id)},
        {
            "$push": {"messages": {"$each": [message.model_dump() for message in messages]}},
            "$set": {"updated_at": datetime.now(UTC)},
        },
    )


async def update_difficulty(session_id: str, difficulty: Level) -> None:
    await get_database().sessions.update_one(
        {"_id": to_object_id(session_id)},
        {"$set": {"difficulty": difficulty.value, "updated_at": datetime.now(UTC)}},
    )


async def set_quiz_questions(session_id: str, question_ids: list[str]) -> None:
    await get_database().sessions.update_one(
        {"_id": to_object_id(session_id)},
        {"$set": {"quiz_question_ids": question_ids, "updated_at": datetime.now(UTC)}},
    )