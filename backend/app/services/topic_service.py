from app.core.exceptions import NotFoundError
from app.db.mongodb import get_database
from app.models.topic import Topic


async def list_topics(subject_slug: str) -> list[Topic]:
    """Topics of one course, in course order."""
    cursor = get_database().topics.find({"subject": subject_slug}).sort("order", 1)
    return [Topic.from_document(document) async for document in cursor]


async def get_topic(slug: str) -> Topic:
    document = await get_database().topics.find_one({"slug": slug})
    if document is None:
        raise NotFoundError(f"Topic '{slug}' was not found.")
    return Topic.from_document(document)


async def count_topics(subject_slug: str) -> int:
    return await get_database().topics.count_documents({"subject": subject_slug})


async def list_all_topics() -> list[Topic]:
    """Topics of every course."""
    cursor = get_database().topics.find()
    return [Topic.from_document(document) async for document in cursor]