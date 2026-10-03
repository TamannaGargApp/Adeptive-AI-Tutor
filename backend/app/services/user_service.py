from datetime import UTC, datetime

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.exceptions import AppError, AuthenticationError, ConflictError, NotFoundError
from app.core.security import hash_password, verify_password
from app.db.mongodb import get_database, to_object_id
from app.models.user import User
from app.schemas.user import ProfileUpdate
from app.services import subject_service

_dummy_password_hash: str | None = None


def _get_dummy_hash() -> str:
    global _dummy_password_hash
    if _dummy_password_hash is None:
        _dummy_password_hash = hash_password("dummy-password-for-timing")
    return _dummy_password_hash


async def create_user(name: str, email: str, password: str) -> User:
    now = datetime.now(UTC)
    document = {
        "name": name,
        "email": email.lower(),
        "password_hash": hash_password(password),
        "level": None,
        "goal": None,
        "preferred_difficulty": None,
        "onboarding_completed": False,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await get_database().users.insert_one(document)
    except DuplicateKeyError as exc:
        raise ConflictError("An account with this email already exists.") from exc
    document["_id"] = result.inserted_id
    return User.from_document(document)


async def get_user_by_id(user_id: str) -> User | None:
    object_id = to_object_id(user_id)
    if object_id is None:
        return None
    document = await get_database().users.find_one({"_id": object_id})
    return User.from_document(document) if document else None


async def authenticate_user(email: str, password: str) -> User:
    document = await get_database().users.find_one({"email": email.lower()})
    if document is None:
        # Hash anyway so response time does not reveal whether the email is registered.
        verify_password(password, _get_dummy_hash())
        raise AuthenticationError("Incorrect email or password.")

    user = User.from_document(document)
    if not verify_password(password, user.password_hash):
        raise AuthenticationError("Incorrect email or password.")
    return user


async def update_profile(user_id: str, update: ProfileUpdate) -> User:
    profile = update.model_dump(mode="json", exclude={"subject_slug"})
    changes: dict = {**profile, "onboarding_completed": True, "updated_at": datetime.now(UTC)}
    operations: dict = {"$set": changes}
    if update.subject_slug:
        await subject_service.get_subject(update.subject_slug)
        operations["$addToSet"] = {"subjects": update.subject_slug}
        changes["current_subject"] = update.subject_slug

    document = await get_database().users.find_one_and_update(
        {"_id": to_object_id(user_id)}, operations, return_document=ReturnDocument.AFTER
    )
    if document is None:
        raise NotFoundError("User not found.")
    return User.from_document(document)


# ---------- Learning plan ----------


async def add_subject_to_plan(user: User, subject_slug: str) -> User:
    await subject_service.get_subject(subject_slug)
    plan = subject_service.plan_subjects(user)
    if subject_slug not in plan:
        plan = [*plan, subject_slug]
    # Adding a course switches to it, since the learner most likely wants to start it now.
    return await _save_plan(user.id, plan, subject_slug)


async def remove_subject_from_plan(user: User, subject_slug: str) -> User:
    plan = subject_service.plan_subjects(user)
    if subject_slug not in plan:
        raise NotFoundError("That course isn't in your plan.")
    if len(plan) == 1:
        raise ConflictError("Your plan needs at least one course. Add another course before removing this one.")
    remaining = [slug for slug in plan if slug != subject_slug]
    current = subject_service.current_subject(user)
    # Progress is kept, so re-adding the course later picks up where the learner left off.
    return await _save_plan(user.id, remaining, current if current != subject_slug else remaining[0])


async def set_current_subject(user: User, subject_slug: str) -> User:
    if subject_slug not in subject_service.plan_subjects(user):
        raise AppError("Add this course to your plan before switching to it.")
    return await _save_plan(user.id, subject_service.plan_subjects(user), subject_slug)


async def _save_plan(user_id: str, subjects: list[str], current: str) -> User:
    document = await get_database().users.find_one_and_update(
        {"_id": to_object_id(user_id)},
        {"$set": {"subjects": subjects, "current_subject": current, "updated_at": datetime.now(UTC)}},
        return_document=ReturnDocument.AFTER,
    )
    if document is None:
        raise NotFoundError("User not found.")
    return User.from_document(document)