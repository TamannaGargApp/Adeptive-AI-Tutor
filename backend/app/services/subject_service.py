from app.core.exceptions import NotFoundError
from app.db.mongodb import get_database
from app.models.subject import Subject
from app.models.user import User

# Accounts created before multi-course support studied Python only.
DEFAULT_SUBJECT = "python"


async def list_subjects() -> list[Subject]:
    cursor = get_database().subjects.find().sort("order", 1)
    return [Subject.from_document(document) async for document in cursor]


async def get_subject(slug: str) -> Subject:
    document = await get_database().subjects.find_one({"slug": slug})
    if document is None:
        raise NotFoundError(f"Course '{slug}' was not found.")
    return Subject.from_document(document)


def plan_subjects(user: User) -> list[str]:
    """The courses in the learner's plan, in the order they were added."""
    return user.subjects or [DEFAULT_SUBJECT]


def current_subject(user: User) -> str:
    plan = plan_subjects(user)
    return user.current_subject if user.current_subject in plan else plan[0]