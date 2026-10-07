from fastapi import APIRouter

from app.core.dependencies import AIDependency

from app.core.dependencies import CurrentUser
from app.schemas.topic import TopicOut
from app.schemas.material import TopicMaterialOut
from app.services import material_service, study_plan_service, subject_service, topic_service

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("", response_model=list[TopicOut])
async def list_topics(user: CurrentUser, subject: str | None = None) -> list[TopicOut]:
    """Topics of one course; defaults to the learner's current course."""
    topics = await topic_service.list_topics(subject or subject_service.current_subject(user))
    return [TopicOut.from_topic(topic) for topic in topics]


@router.get("/{topic_slug}/material", response_model=TopicMaterialOut)
async def get_topic_material(topic_slug: str, user: CurrentUser, ai: AIDependency) -> TopicMaterialOut:
    """The topic's reading material. Written by the AI on first request, then served from storage."""
    material = await material_service.get_material(topic_slug, ai)
    await study_plan_service.record_reading(user.id, topic_slug)
    return material