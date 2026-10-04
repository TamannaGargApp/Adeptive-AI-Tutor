from datetime import datetime

from pydantic import BaseModel


class FeedbackArea(BaseModel):
    area: str
    why: str
    how: str


class FeedbackResponse(BaseModel):
    """AI output schema for a personalized feedback report."""

    summary: str
    strengths: list[str]
    areas_to_improve: list[FeedbackArea]
    mistake_patterns: list[str]
    next_steps: list[str]
    encouragement: str


class FeedbackReportOut(BaseModel):
    subject_slug: str
    report: FeedbackResponse
    created_at: datetime
    # How many answers the report was based on.
    based_on_answers: int
    # True when new answers have been given since this report, so a refresh would add something.
    can_refresh: bool