from fastapi import APIRouter, Query, status

from app.core.dependencies import AIDependency, CurrentUser
from app.schemas.study_plan import (
    AcceptRequest,
    CourseSuggestionResponse,
    DraftOut,
    DraftRequest,
    GoalIn,
    StudyPlanOut,
    TaskUpdate,
)
from app.services import study_plan_service

# One goal-based study plan per learner, spanning any of their courses. `tz` (the browser's
# timezone) decides what "today" is.
router = APIRouter(prefix="/api/study-plan", tags=["study plan"])

TIMEZONE_HELP = 'The learner\'s IANA timezone, e.g. "Asia/Kolkata". Defaults to UTC.'


@router.get("", response_model=StudyPlanOut | None)
async def get_study_plan(
    user: CurrentUser, tz: str | None = Query(default=None, description=TIMEZONE_HELP)
) -> StudyPlanOut | None:
    return await study_plan_service.get_plan(user, tz or "")


@router.post("/suggest-courses", response_model=CourseSuggestionResponse)
async def suggest_courses(data: GoalIn, user: CurrentUser, ai: AIDependency) -> CourseSuggestionResponse:
    """Step 2: courses from the catalogue that serve the learner's goal."""
    return await study_plan_service.suggest_courses(user, data, ai)


@router.post("/draft", response_model=DraftOut)
async def build_draft(
    data: DraftRequest,
    user: CurrentUser,
    ai: AIDependency,
    tz: str | None = Query(default=None, description=TIMEZONE_HELP),
) -> DraftOut:
    """A plan draft for review. Nothing is saved. With a change request the AI revises the strategy;
    without one (and with an existing strategy) the draft is just rescheduled."""
    return await study_plan_service.build_draft(user, data, ai, tz or "")


@router.post("/accept", response_model=StudyPlanOut)
async def accept_plan(
    data: AcceptRequest, user: CurrentUser, tz: str | None = Query(default=None, description=TIMEZONE_HELP)
) -> StudyPlanOut:
    """Save the approved draft as the learner's plan (replacing any previous one)."""
    return await study_plan_service.accept_plan(user, data, tz or "")


@router.post("/replan", response_model=StudyPlanOut)
async def replan(user: CurrentUser, tz: str | None = Query(default=None, description=TIMEZONE_HELP)) -> StudyPlanOut:
    """Rebuild the schedule from today with the same strategy, e.g. after missing some days."""
    return await study_plan_service.replan(user, tz or "")


@router.patch("/tasks/{task_id}", response_model=StudyPlanOut)
async def update_task(
    task_id: str,
    data: TaskUpdate,
    user: CurrentUser,
    tz: str | None = Query(default=None, description=TIMEZONE_HELP),
) -> StudyPlanOut:
    return await study_plan_service.set_task_done(user, task_id, data.done, tz or "")


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(user: CurrentUser) -> None:
    """Delete the plan. Its courses stay in My courses with their progress."""
    await study_plan_service.delete_plan(user)