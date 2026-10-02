from datetime import datetime

from pydantic import BaseModel

from app.models.enums import CompletionStatus, LearningMode, Level, Mastery


class CompletionRequirement(BaseModel):
    label: str
    met: bool
    progress: str


class TopicProgressOut(BaseModel):
    topic_slug: str
    topic_name: str
    questions_attempted: int
    correct_answers: int
    accuracy: float
    mastery: Mastery
    current_difficulty: Level
    strengths: list[str]
    weaknesses: list[str]
    last_attempted_at: datetime | None
    # Completion standard (see progress_service.calculate_completion).
    completion_percent: int
    completion_status: CompletionStatus
    completed: bool
    remarks: list[str]
    requirements: list[CompletionRequirement]
    concepts_covered: list[str]
    concepts_remaining: list[str]
    recent_correct: int
    recent_answered: int


class OverallProgress(BaseModel):
    questions_attempted: int
    correct_answers: int
    accuracy: float
    completion_percent: int
    topics_completed: int
    topics: list[TopicProgressOut]


class RecommendationResponse(BaseModel):
    topic_slug: str
    topic_name: str
    reason: str
    message: str
    suggested_mode: LearningMode
    suggested_difficulty: Level