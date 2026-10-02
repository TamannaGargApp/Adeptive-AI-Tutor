from pydantic import BaseModel, Field

from app.models.enums import Level
from app.schemas.progress import RecommendationResponse
from app.schemas.tutor import QuestionOut, QuestionResponse


class QuizResponse(BaseModel):
    """AI output schema for a generated quiz."""

    questions: list[QuestionResponse] = Field(min_length=1)


class QuizRequest(BaseModel):
    session_id: str


class QuizOut(BaseModel):
    session_id: str
    topic_slug: str
    difficulty: Level
    questions: list[QuestionOut]


class QuizResult(BaseModel):
    session_id: str
    topic_slug: str
    total_questions: int
    answered: int
    correct: int
    accuracy: float
    strong_areas: list[str]
    needs_practice: list[str]
    recommendation: RecommendationResponse
