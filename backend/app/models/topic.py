from app.models.base import MongoModel


class Topic(MongoModel):
    slug: str
    name: str
    description: str
    key_concepts: list[str]
    order: int
    subject: str = "python"
