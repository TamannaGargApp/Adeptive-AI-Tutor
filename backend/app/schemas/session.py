from datetime import datetime

from pydantic import BaseModel

from app.models.enums import LearningMode, Level
from app.models.session import ChatMessage, LearningSession, without_notes_sources


class SessionCreate(BaseModel):
    topic_slug: str
    mode: LearningMode
    # When omitted, the learner's adaptive difficulty for this topic is used.
    difficulty: Level | None = None
    # Learn mode only: continue the most recent conversation for this topic instead of starting fresh.
    resume: bool = False


class SessionSummary(BaseModel):
    """One past conversation in the Learn history list (without the full message history)."""

    id: str
    difficulty: Level
    message_count: int
    preview: str
    created_at: datetime
    updated_at: datetime


class SessionOut(BaseModel):
    id: str
    topic_slug: str
    mode: LearningMode
    difficulty: Level
    messages: list[ChatMessage]
    created_at: datetime

    @classmethod
    def from_session(cls, session: LearningSession, show_sources: bool = False) -> "SessionOut":
        out = cls.model_validate(session.model_dump())
        if not show_sources:
            out.messages = without_notes_sources(out.messages)
        return out