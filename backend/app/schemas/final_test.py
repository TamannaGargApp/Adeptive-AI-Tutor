from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import Level
from app.models.final_test import FinalTestResult
from app.schemas.progress import RecommendationResponse
from app.schemas.tutor import QuestionOut


class FinalTestCreate(BaseModel):
    topic_slug: str


class AnswerSave(BaseModel):
    question_id: str
    answer: str = Field(max_length=2000)


class FinalTestSubmit(BaseModel):
    # The latest answers from the browser, so nothing typed just before submitting is lost.
    answers: dict[str, str] = Field(default_factory=dict)


class FinalTestOut(BaseModel):
    id: str
    topic_slug: str
    topic_name: str
    difficulty: Level
    questions: list[QuestionOut]
    answers: dict[str, str]
    time_limit_seconds: int
    # Calculated by the server when the response is built, so the browser's clock doesn't matter.
    seconds_remaining: int
    started_at: datetime
    submitted: bool
    result: FinalTestResult | None
    recommendation: RecommendationResponse | None