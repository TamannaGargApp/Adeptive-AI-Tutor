from datetime import datetime

from pydantic import BaseModel

from app.models.base import MongoModel
from app.models.enums import Level


class ConceptScore(BaseModel):
    concept: str
    correct: int
    total: int


class QuestionReview(BaseModel):
    question_id: str
    prompt: str
    code: str | None
    options: list[str]
    question_type: str
    concept: str
    your_answer: str
    correct_answer: str
    explanation: str
    correct: bool


class FinalTestResult(BaseModel):
    correct: int
    total: int
    accuracy: float
    time_taken_seconds: int
    finished_by: str  # "submitted" or "time_up"
    concept_scores: list[ConceptScore]
    strong_areas: list[str]
    needs_practice: list[str]
    remarks: list[str]
    review: list[QuestionReview]


class FinalTest(MongoModel):
    user_id: str
    topic_slug: str
    difficulty: Level
    question_ids: list[str]
    # Answers keyed by question id, autosaved while the test is running.
    answers: dict[str, str] = {}
    time_limit_seconds: int
    started_at: datetime
    submitted_at: datetime | None = None
    result: FinalTestResult | None = None
    created_at: datetime