from fastapi import APIRouter

from app.core.dependencies import CurrentUser
from app.schemas.topic import TopicOut
from app.services import topic_service

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("", response_model=list[TopicOut])
async def list_topics(_: CurrentUser) -> list[TopicOut]:
    topics = await topic_service.list_topics()
    return [TopicOut.from_topic(topic) for topic in topics]
