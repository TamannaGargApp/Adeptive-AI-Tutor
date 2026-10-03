from datetime import UTC, datetime

from app.core.exceptions import AppError, NotFoundError
from app.db.mongodb import get_database, to_object_id
from app.models.enums import LearningMode, Level
from app.models.session import ChatMessage, LearningSession
from app.models.user import User
from app.schemas.session import SessionCreate, SessionSummary
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


HISTORY_LIMIT = 30
PREVIEW_LENGTH = 90


async def list_learn_sessions(user_id: str, topic_slug: str) -> list[SessionSummary]:
    """Past Learn conversations for a topic, newest first. Empty conversations are skipped."""
    pipeline = [
        {"$match": {"user_id": user_id, "topic_slug": topic_slug, "mode": LearningMode.LEARN.value, "messages.0": {"$exists": True}}},
        {"$sort": {"updated_at": -1}},
        {"$limit": HISTORY_LIMIT},
        # Only the first few messages are needed for the preview, so the full history isn't loaded.
        {
            "$project": {
                "difficulty": 1,
                "created_at": 1,
                "updated_at": 1,
                "message_count": {"$size": "$messages"},
                "first_messages": {"$slice": ["$messages", 4]},
            }
        },
    ]
    cursor = await get_database().sessions.aggregate(pipeline)
    return [
        SessionSummary(
            id=str(document["_id"]),
            difficulty=document["difficulty"],
            message_count=document["message_count"],
            preview=_conversation_preview(document["first_messages"]),
            created_at=document["created_at"],
            updated_at=document["updated_at"],
        )
        async for document in cursor
    ]


def _conversation_preview(messages: list[dict]) -> str:
    """The learner's first question, or the opening of the tutor's first reply."""
    first_student = next((m["content"] for m in messages if m["role"] == "student"), None)
    text = first_student or messages[0]["content"]
    text = " ".join(text.replace("#", "").replace("*", "").split())
    return text if len(text) <= PREVIEW_LENGTH else text[: PREVIEW_LENGTH - 1].rstrip() + "…"


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