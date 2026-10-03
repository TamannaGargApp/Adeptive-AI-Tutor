from fastapi import APIRouter, Query

from app.core.dependencies import CurrentUser
from app.schemas.gamification import ActivityHistory, GamificationOut
from app.services import gamification_service

router = APIRouter(tags=["gamification"])

TIMEZONE_HELP = 'The learner\'s IANA timezone, e.g. "Asia/Kolkata". Defaults to UTC.'


@router.get("/api/gamification", response_model=GamificationOut)
async def get_gamification(
    user: CurrentUser, tz: str | None = Query(default=None, description=TIMEZONE_HELP)
) -> GamificationOut:
    """Streak, XP level and badges. Also records any badges earned since the last call."""
    return await gamification_service.get_summary(user, tz or "")


@router.get("/api/activity", response_model=ActivityHistory)
async def get_activity(
    user: CurrentUser,
    tz: str | None = Query(default=None, description=TIMEZONE_HELP),
    days: int = Query(default=30, ge=1, le=gamification_service.MAX_HISTORY_DAYS),
) -> ActivityHistory:
    """Questions, accuracy, Learn messages and XP per day, for the progress charts."""
    return await gamification_service.get_activity_history(user, tz or "", days)