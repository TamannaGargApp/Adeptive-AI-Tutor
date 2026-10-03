from fastapi import APIRouter

from app.core.dependencies import CurrentUser
from app.schemas.topic import TopicOut
from app.services import subject_service, topic_service

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("", response_model=list[TopicOut])
async def list_topics(user: CurrentUser, subject: str | None = None) -> list[TopicOut]:
    """Topics of one course; defaults to the learner's current course."""
    topics = await topic_service.list_topics(subject or subject_service.current_subject(user))
    return [TopicOut.from_topic(topic) for topic in topics]