from datetime import datetime

from pydantic import BaseModel

from app.models.base import MongoModel
from app.models.enums import LearningMode, Level, QuestionType


class TestCase(BaseModel):
    """For coding exercises: `input` is an expression to print after running the learner's code
    (e.g. "add(2, 3)"), or "" to compare everything the program itself prints."""

    input: str
    expected_output: str


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
    # Coding exercises only.
    starter_code: str | None = None
    test_cases: list[TestCase] = []
    # Code language of the course, used to run coding exercises ("python" or "javascript").
    language: str = "python"
    attempt_count: int = 0
    solved: bool = False
    created_at: datetime