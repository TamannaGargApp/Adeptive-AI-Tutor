from datetime import datetime

from app.models.base import MongoModel
from app.models.enums import LearningMode, Level, QuestionType


class Question(MongoModel):
    user_id: str
    session_id: str
    topic_slug: str
    mode: LearningMode
    difficulty: Level
    question_type: QuestionType
    prompt: str
    code: str | None = None
    options: list[str] = []
    correct_answer: str
    explanation: str
    concept: str
    hint: str
    attempt_count: int = 0
    solved: bool = False
    created_at: datetime
