from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import Level
from app.models.final_test import FinalTestResult
from app.schemas.progress import RecommendationResponse
from app.schemas.tutor import QuestionOut, QuestionResponse


class FinalTestCreate(BaseModel):
    """Start a topic test (topic_slug) or a course exam (subject_slug)."""

    topic_slug: str | None = None
    subject_slug: str | None = None

    @model_validator(mode="after")
    def exactly_one_scope(self) -> "FinalTestCreate":
        if bool(self.topic_slug) == bool(self.subject_slug):
            raise ValueError("Provide either topic_slug or subject_slug.")
        return self


class AnswerSave(BaseModel):
    question_id: str
    answer: str = Field(max_length=2000)


class QuestionStatusUpdate(BaseModel):
    question_id: str
    # Leave a field out to keep its current value.
    flagged: bool | None = None
    visited: bool | None = None


class FinalTestSubmit(BaseModel):
    # The latest answers from the browser, so nothing typed just before submitting is lost.
    answers: dict[str, str] = Field(default_factory=dict)


class CourseExamQuestion(QuestionResponse):
    """AI output for a course exam question: a normal question tagged with its topic."""

    topic_slug: str


class CourseExamResponse(BaseModel):
    questions: list[CourseExamQuestion] = Field(min_length=1)


class FinalTestOut(BaseModel):
    id: str
    scope: str
    title: str
    subject_slug: str
    topic_slug: str | None
    difficulty: Level
    questions: list[QuestionOut]
    answers: dict[str, str]
    flagged: list[str]
    visited: list[str]
    time_limit_seconds: int
    # Calculated by the server when the response is built, so the browser's clock doesn't matter.
    seconds_remaining: int
    started_at: datetime
    submitted: bool
    result: FinalTestResult | None
    recommendation: RecommendationResponse | None