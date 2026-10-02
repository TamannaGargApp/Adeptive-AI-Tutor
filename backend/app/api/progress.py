from fastapi import APIRouter

from app.core.dependencies import CurrentUser
from app.schemas.progress import OverallProgress, TopicProgressOut
from app.services import progress_service

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get("", response_model=OverallProgress)
async def get_progress(user: CurrentUser) -> OverallProgress:
    return await progress_service.get_overall_progress(user)


@router.get("/{topic_slug}", response_model=TopicProgressOut)
async def get_topic_progress(topic_slug: str, user: CurrentUser) -> TopicProgressOut:
    return await progress_service.get_topic_progress_out(user, topic_slug)
