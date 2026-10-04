from app.core.exceptions import NotFoundError
from app.db.mongodb import get_database
from app.models.topic import Topic


# Matches documents that aren't archived, including ones created before archiving existed.
NOT_ARCHIVED = {"archived": {"$ne": True}}


async def list_topics(subject_slug: str, include_archived: bool = False) -> list[Topic]:
    """Topics of one course, in course order. Archived topics are only included for admins."""
    query: dict = {"subject": subject_slug} if include_archived else {"subject": subject_slug, **NOT_ARCHIVED}
    cursor = get_database().topics.find(query).sort("order", 1)
    return [Topic.from_document(document) async for document in cursor]


async def get_topic(slug: str) -> Topic:
    document = await get_database().topics.find_one({"slug": slug})
    if document is None:
        raise NotFoundError(f"Topic '{slug}' was not found.")
    return Topic.from_document(document)


async def count_topics(subject_slug: str) -> int:
    return await get_database().topics.count_documents({"subject": subject_slug, **NOT_ARCHIVED})


async def list_all_topics() -> list[Topic]:
    """Topics of every course."""
    cursor = get_database().topics.find()
    return [Topic.from_document(document) async for document in cursor]