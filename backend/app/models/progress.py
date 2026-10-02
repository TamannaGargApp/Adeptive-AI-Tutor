from datetime import datetime

from pydantic import BaseModel

from app.models.base import MongoModel
from app.models.enums import Level, Mastery


class ConceptStat(BaseModel):
    concept: str
    attempted: int = 0
    correct: int = 0


class TopicProgress(MongoModel):
    user_id: str
    topic_slug: str
    questions_attempted: int = 0
    correct_answers: int = 0
    accuracy: float = 0.0
    mastery: Mastery = Mastery.NOT_STARTED
    current_difficulty: Level
    # Concept stats are a list (not a dict) because concept names may contain dots,
    # which MongoDB does not allow in field names.
    concept_stats: list[ConceptStat] = []
    # Results since the last difficulty change; restarts at each new level (see adjust_difficulty).
    recent_results: list[bool] = []
    # The last 10 first-attempt results, never reset. Used by the completion standard.
    last_answers: list[bool] = []
    last_attempted_at: datetime | None = None