from fastapi import APIRouter

from app.core.dependencies import AIDependency, CurrentUser
from app.schemas.feedback import FeedbackReportOut
from app.services import feedback_service, subject_service

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.get("", response_model=FeedbackReportOut | None)
async def get_feedback(user: CurrentUser, subject: str | None = None) -> FeedbackReportOut | None:
    """The latest personalized feedback report for a course (defaults to the current course)."""
    return await feedback_service.get_latest_report(user, subject or subject_service.current_subject(user))


@router.post("", response_model=FeedbackReportOut)
async def create_feedback(user: CurrentUser, ai: AIDependency, subject: str | None = None) -> FeedbackReportOut:
    """Generate a new report, or return the latest one if nothing new has been answered since."""
    return await feedback_service.generate_report(user, subject or subject_service.current_subject(user), ai)