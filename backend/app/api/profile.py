from fastapi import APIRouter

from app.core.dependencies import CurrentUser
from app.schemas.user import ProfileUpdate, UserPublic
from app.services import user_service

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.get("", response_model=UserPublic)
async def get_profile(user: CurrentUser) -> UserPublic:
    return UserPublic.from_user(user)


@router.put("", response_model=UserPublic)
async def update_profile(data: ProfileUpdate, user: CurrentUser) -> UserPublic:
    updated = await user_service.update_profile(user.id, data)
    return UserPublic.from_user(updated)
