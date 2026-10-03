from datetime import datetime

from pydantic import BaseModel

from app.models.base import MongoModel
from app.models.enums import Level


class ConceptScore(BaseModel):
    concept: str
    correct: int
    total: int


class TopicScore(BaseModel):
    topic_slug: str
    topic_name: str
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
    # Set in course exams, where questions come from different topics.
    topic_name: str | None = None


class FinalTestResult(BaseModel):
    correct: int
    total: int
    accuracy: float
    time_taken_seconds: int
    finished_by: str  # "submitted" or "time_up"
    concept_scores: list[ConceptScore]
    # Course exams only: results per topic.
    topic_scores: list[TopicScore] = []
    strong_areas: list[str]
    needs_practice: list[str]
    remarks: list[str]
    review: list[QuestionReview]
    # Whether the score reached the pass mark (needed to complete the topic or course).
    passed: bool = False
    pass_mark: float = 70.0
    # After a fail: when the next attempt opens (set when a cooldown starts),
    # and failed attempts in a row so far (topic tests, before the first pass).
    retry_available_at: datetime | None = None
    fails_in_row: int = 0


class FinalTest(MongoModel):
    user_id: str
    # "topic" tests one topic; "course" is the course exam across all of a course's topics.
    # Defaults cover tests created before course exams existed (all Python topic tests).
    scope: str = "topic"
    subject_slug: str = "python"
    topic_slug: str | None = None
    difficulty: Level
    question_ids: list[str]
    # Answers keyed by question id, autosaved while the test is running.
    answers: dict[str, str] = {}
    # Question status shown in the navigator: marked for review, and opened at least once.
    flagged: list[str] = []
    visited: list[str] = []
    time_limit_seconds: int
    started_at: datetime
    submitted_at: datetime | None = None
    result: FinalTestResult | None = None
    created_at: datetime