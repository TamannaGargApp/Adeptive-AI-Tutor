from datetime import datetime

from app.models.base import MongoModel
from app.models.enums import LearningGoal, Level


class User(MongoModel):
    name: str
    email: str
    password_hash: str
    level: Level | None = None
    goal: LearningGoal | None = None
    preferred_difficulty: Level | None = None
    onboarding_completed: bool = False
    # Learning plan: course slugs the learner is studying, and the one currently shown.
    subjects: list[str] = []
    current_subject: str | None = None
    created_at: datetime
    updated_at: datetime