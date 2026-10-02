from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.base import MongoModel
from app.models.enums import LearningMode, Level


class ChatMessage(BaseModel):
    role: Literal["student", "tutor"]
    content: str
    created_at: datetime


class LearningSession(MongoModel):
    user_id: str
    topic_slug: str
    mode: LearningMode
    difficulty: Level
    messages: list[ChatMessage] = []
    quiz_question_ids: list[str] = []
    created_at: datetime
    updated_at: datetime
