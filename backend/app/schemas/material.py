from datetime import datetime

from pydantic import BaseModel, Field


class StudyMaterialResponse(BaseModel):
    """AI output schema for a topic's reading material."""

    content: str
    key_takeaways: list[str]


class TopicMaterialOut(BaseModel):
    topic_slug: str
    topic_name: str
    # Markdown study notes; code blocks in the course language can be run in the browser.
    content: str
    key_takeaways: list[str]
    updated_at: datetime
    # True once an admin has edited the notes by hand.
    edited: bool


class TopicMaterialIn(BaseModel):
    content: str = Field(min_length=20, max_length=50_000)
    key_takeaways: list[str] = Field(default_factory=list, max_length=12)