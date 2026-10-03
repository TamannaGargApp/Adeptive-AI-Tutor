from fastapi import APIRouter

from app.core.dependencies import CurrentUser
from app.schemas.progress import OverallProgress, TopicProgressOut
from app.services import progress_service, subject_service

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("", response_model=OverallProgress)
async def get_progress(user: CurrentUser, subject: str | None = None) -> OverallProgress:
    """Progress for one course; defaults to the learner's current course."""
    return await progress_service.get_overall_progress(user, subject or subject_service.current_subject(user))


@router.get("/{topic_slug}", response_model=TopicProgressOut)
async def get_topic_progress(topic_slug: str, user: CurrentUser) -> TopicProgressOut:
    return await progress_service.get_topic_progress_out(user, topic_slug)