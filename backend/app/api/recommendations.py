from fastapi import APIRouter

from app.core.dependencies import CurrentUser
from app.schemas.progress import RecommendationResponse
from app.services import recommendation_service

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationResponse)
async def get_recommendation(user: CurrentUser) -> RecommendationResponse:
    return await recommendation_service.recommend_next_topic(user)
