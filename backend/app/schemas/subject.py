from pydantic import BaseModel


class SubjectOut(BaseModel):
    slug: str
    name: str
    description: str
    language: str
    topic_count: int
    in_plan: bool
    current: bool


class CurrentSubjectUpdate(BaseModel):
    subject_slug: str