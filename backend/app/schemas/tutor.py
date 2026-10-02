"""Schemas for the tutor endpoints.

The *Response models (LessonResponse, QuestionResponse, EvaluationResponse) describe what Gemini
must return. They are passed to Gemini as the response schema and validated again on our side.
Gemini's schema support is limited, so these models avoid default values and complex types.
"""

import re

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import Level, QuestionType
from app.models.question import Question
from app.models.session import ChatMessage

# ---------- AI output schemas ----------


class LessonResponse(BaseModel):
    explanation: str
    example_code: str | None
    example_explanation: str | None
    check_question: str | None
    on_topic: bool


class QuestionResponse(BaseModel):
    question_type: str
    prompt: str
    code: str | None
    options: list[str]
    correct_answer: str
    explanation: str
    concept: str
    hint: str

    @field_validator("question_type")
    @classmethod
    def normalize_question_type(cls, value: str) -> str:
        normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
        allowed = {item.value for item in QuestionType}
        if normalized not in allowed:
            raise ValueError(f"question_type must be one of {sorted(allowed)}")
        return normalized

    @field_validator("code")
    @classmethod
    def empty_code_to_none(cls, value: str | None) -> str | None:
        return value if value and value.strip() else None

    @model_validator(mode="after")
    def check_options_match_type(self) -> "QuestionResponse":
        if self.question_type != QuestionType.MULTIPLE_CHOICE:
            self.options = []
            return self

        options = [option.strip() for option in self.options if option.strip()]
        if not 2 <= len(options) <= 5:
            raise ValueError("Multiple choice questions need between 2 and 5 options.")
        self.options = options
        self.correct_answer = _resolve_correct_option(self.correct_answer, options)
        return self


def _resolve_correct_option(answer: str, options: list[str]) -> str:
    """Models sometimes answer with a letter ("B") instead of the option text."""
    cleaned = answer.strip()
    for option in options:
        if option.lower() == cleaned.lower():
            return option
    letter_match = re.fullmatch(r"([A-Ea-e])[.)]?", cleaned)
    if letter_match:
        index = ord(letter_match.group(1).upper()) - ord("A")
        if index < len(options):
            return options[index]
    raise ValueError("correct_answer must match one of the options.")


class EvaluationResponse(BaseModel):
    correct: bool
    score: int = Field(ge=0, le=100)
    feedback: str
    hint: str | None
    correct_answer: str | None
    concept: str
    difficulty: str


# ---------- API request / response schemas ----------


class LearnRequest(BaseModel):
    session_id: str
    # Empty message means "start the lesson".
    message: str = Field(default="", max_length=2000)


class LearnReply(BaseModel):
    session_id: str
    reply: ChatMessage
    lesson: LessonResponse


class PracticeRequest(BaseModel):
    session_id: str


class QuestionOut(BaseModel):
    """A question as shown to the learner: never includes the answer or explanation."""

    id: str
    topic_slug: str
    difficulty: Level
    question_type: QuestionType
    prompt: str
    code: str | None
    options: list[str]
    concept: str

    @classmethod
    def from_question(cls, question: Question) -> "QuestionOut":
        return cls.model_validate(question.model_dump())


class EvaluateRequest(BaseModel):
    question_id: str
    answer: str = Field(min_length=1, max_length=2000)


class EvaluationResult(BaseModel):
    question_id: str
    correct: bool
    score: int
    feedback: str
    hint: str | None
    correct_answer: str | None
    explanation: str | None
    concept: str
    difficulty: Level
    attempt_number: int
    can_retry: bool
    next_difficulty: Level
    difficulty_changed: bool
