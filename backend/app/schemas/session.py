from datetime import datetime

from pydantic import BaseModel

from app.models.enums import LearningMode, Level
from app.models.session import ChatMessage, LearningSession


class SessionCreate(BaseModel):
    topic_slug: str
    mode: LearningMode
    # When omitted, the learner's adaptive difficulty for this topic is used.
    difficulty: Level | None = None
    # Learn mode only: continue the most recent conversation for this topic instead of starting fresh.
    resume: bool = False


class SessionOut(BaseModel):
    id: str
    topic_slug: str
    mode: LearningMode
    difficulty: Level
    messages: list[ChatMessage]
    created_at: datetime

    @classmethod
    def from_session(cls, session: LearningSession) -> "SessionOut":
        return cls.model_validate(session.model_dump())