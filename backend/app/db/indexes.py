from pymongo import ASCENDING, DESCENDING

from app.db.mongodb import get_database


async def create_indexes() -> None:
    db = get_database()
    await db.users.create_index("email", unique=True)
    await db.topics.create_index("slug", unique=True)
    await db.topics.create_index("order")
    await db.sessions.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await db.sessions.create_index(
        [("user_id", ASCENDING), ("topic_slug", ASCENDING), ("mode", ASCENDING), ("updated_at", DESCENDING)]
    )
    await db.final_tests.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await db.questions.create_index([("user_id", ASCENDING), ("session_id", ASCENDING)])
    await db.attempts.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    await db.attempts.create_index("question_id")
    await db.topic_progress.create_index(
        [("user_id", ASCENDING), ("topic_slug", ASCENDING)], unique=True
    )