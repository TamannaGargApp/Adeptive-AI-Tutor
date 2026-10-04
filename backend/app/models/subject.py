from app.models.base import MongoModel


class Subject(MongoModel):
    """A course, e.g. Python or JavaScript. Each topic belongs to one subject."""

    slug: str
    name: str
    description: str
    # Used for code examples and prompts, e.g. "python" or "javascript".
    language: str
    order: int
    # Archived content is hidden from learners but kept, so existing progress stays valid.
    archived: bool = False