from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class NotesUpload(BaseModel):
    """Text extracted from an admin's notes file in the browser, after the admin reviewed it."""

    file_name: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=50, max_length=200_000)

    @field_validator("text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class CourseNotesFile(BaseModel):
    id: str
    topic_slug: str
    file_name: str
    characters: int
    sections: int
    uploaded_at: datetime