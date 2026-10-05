from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.base import MongoModel
from app.models.enums import LearningMode, Level


class ChatMessage(BaseModel):
    role: Literal["student", "tutor"]
    content: str
    created_at: datetime
    # Names of files the learner attached to this message. Only names are stored: the file
    # contents stay in the learner's browser and are sent with each question, never saved here.
    attachments: list[str] = []
    # Tutor replies only: course notes files the reply drew on. Shown to admins, removed for learners.
    notes_sources: list[str] = []


def without_notes_sources(messages: list[ChatMessage]) -> list[ChatMessage]:
    """Source labels are for admins only; learners get the same messages without them."""
    return [message.model_copy(update={"notes_sources": []}) for message in messages]


class LearningSession(MongoModel):
    user_id: str
    topic_slug: str
    mode: LearningMode
    difficulty: Level
    messages: list[ChatMessage] = []
    quiz_question_ids: list[str] = []
    created_at: datetime
    updated_at: datetime