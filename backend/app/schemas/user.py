from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import LearningGoal, Level
from app.models.user import User


class UserPublic(BaseModel):
    """The only user shape ever sent to the frontend. It deliberately has no password_hash."""

    id: str
    name: str
    email: str
    level: Level | None
    goal: LearningGoal | None
    preferred_difficulty: Level | None
    onboarding_completed: bool
    created_at: datetime

    @classmethod
    def from_user(cls, user: User) -> "UserPublic":
        return cls.model_validate(user.model_dump(exclude={"password_hash", "updated_at"}))


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    level: Level
    goal: LearningGoal
    preferred_difficulty: Level

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank.")
        return value
