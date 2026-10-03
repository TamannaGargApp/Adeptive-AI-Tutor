from fastapi import APIRouter

from app.core.dependencies import CurrentUser
from app.schemas.subject import CurrentSubjectUpdate, SubjectOut
from app.schemas.user import UserPublic
from app.services import subject_service, topic_service, user_service

router = APIRouter(tags=["courses"])


@router.get("/api/subjects", response_model=list[SubjectOut])
async def list_subjects(user: CurrentUser) -> list[SubjectOut]:
    plan = subject_service.plan_subjects(user)
    current = subject_service.current_subject(user)
    return [
        SubjectOut(
            slug=subject.slug,
            name=subject.name,
            description=subject.description,
            language=subject.language,
            topic_count=await topic_service.count_topics(subject.slug),
            in_plan=subject.slug in plan,
            current=subject.slug == current,
        )
        for subject in await subject_service.list_subjects()
    ]


@router.post("/api/plan/subjects/{subject_slug}", response_model=UserPublic)
async def add_to_plan(subject_slug: str, user: CurrentUser) -> UserPublic:
    return UserPublic.from_user(await user_service.add_subject_to_plan(user, subject_slug))


@router.delete("/api/plan/subjects/{subject_slug}", response_model=UserPublic)
async def remove_from_plan(subject_slug: str, user: CurrentUser) -> UserPublic:
    return UserPublic.from_user(await user_service.remove_subject_from_plan(user, subject_slug))


@router.put("/api/plan/current", response_model=UserPublic)
async def set_current_subject(data: CurrentSubjectUpdate, user: CurrentUser) -> UserPublic:
    return UserPublic.from_user(await user_service.set_current_subject(user, data.subject_slug))