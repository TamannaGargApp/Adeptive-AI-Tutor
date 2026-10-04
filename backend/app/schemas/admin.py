from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class CourseStats(BaseModel):
    slug: str
    name: str
    archived: bool
    topics: int
    learners: int


class AdminStats(BaseModel):
    users: int
    active_last_7_days: int
    questions_answered: int
    tests_submitted: int
    courses: list[CourseStats]


class AdminUserRow(BaseModel):
    id: str
    name: str
    email: str
    is_admin: bool
    subjects: list[str]
    questions_answered: int
    last_active: datetime | None
    created_at: datetime


def _clean(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("This field can't be blank.")
    return value


class CourseIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=300)
    language: str = Field(pattern=r"^(python|javascript)$")
    archived: bool = False

    @field_validator("name", "description")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return _clean(value)


class AdminCourse(BaseModel):
    slug: str
    name: str
    description: str
    language: str
    archived: bool
    order: int


class TopicIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    description: str = Field(min_length=1, max_length=300)
    key_concepts: list[str] = Field(min_length=1, max_length=12)
    archived: bool = False

    @field_validator("name", "description")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return _clean(value)

    @field_validator("key_concepts")
    @classmethod
    def clean_concepts(cls, concepts: list[str]) -> list[str]:
        cleaned = []
        for concept in concepts:
            concept = " ".join(concept.split())
            if concept and concept.lower() not in {c.lower() for c in cleaned}:
                cleaned.append(concept[:60])
        if not cleaned:
            raise ValueError("Add at least one key concept.")
        return cleaned


class TopicCreate(TopicIn):
    subject_slug: str


class AdminTopic(BaseModel):
    slug: str
    subject: str
    name: str
    description: str
    key_concepts: list[str]
    order: int
    archived: bool


class CourseDeletePreview(BaseModel):
    """What deleting a course would remove, shown before the admin confirms."""

    slug: str
    name: str
    topics: int
    learners: int
    answers: int
    can_delete: bool
    reason: str | None


class TopicMove(BaseModel):
    direction: str = Field(pattern=r"^(up|down)$")