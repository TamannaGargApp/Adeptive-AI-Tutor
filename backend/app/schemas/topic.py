from pydantic import BaseModel

from app.models.topic import Topic


class TopicOut(BaseModel):
    slug: str
    name: str
    description: str
    key_concepts: list[str]
    order: int
    subject: str

    @classmethod
    def from_topic(cls, topic: Topic) -> "TopicOut":
        return cls.model_validate(topic.model_dump())