from fastapi import APIRouter

from app.core.dependencies import CurrentUser
from app.schemas.progress import RecommendationResponse
from app.services import recommendation_service, subject_service

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationResponse)
async def get_recommendation(user: CurrentUser, subject: str | None = None) -> RecommendationResponse:
    """What to study next in one course; defaults to the learner's current course."""
    return await recommendation_service.recommend_next_topic(user, subject or subject_service.current_subject(user))