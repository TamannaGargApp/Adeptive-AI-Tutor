from app.core.exceptions import NotFoundError
from app.db.mongodb import get_database
from app.models.topic import Topic


async def list_topics() -> list[Topic]:
    cursor = get_database().topics.find().sort("order", 1)
    return [Topic.from_document(document) async for document in cursor]


async def get_topic(slug: str) -> Topic:
    document = await get_database().topics.find_one({"slug": slug})
    if document is None:
        raise NotFoundError(f"Topic '{slug}' was not found.")
    return Topic.from_document(document)
