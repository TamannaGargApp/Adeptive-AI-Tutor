"""Admin dashboard: platform statistics, learners, and course/topic content management.

Content is archived rather than deleted, so learners' existing progress, questions and test results
always keep pointing at a valid course or topic.
"""

import re
from datetime import UTC, datetime, timedelta

from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.db.mongodb import get_database
from app.schemas.admin import (
    AdminCourse,
    AdminStats,
    AdminTopic,
    AdminUserRow,
    CourseDeletePreview,
    CourseIn,
    CourseStats,
    TopicCreate,
    TopicIn,
)
from app.services import subject_service

ACTIVE_WINDOW = timedelta(days=7)
USER_LIST_LIMIT = 200


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# ---------- Statistics ----------


async def get_stats() -> AdminStats:
    db = get_database()
    active_since = datetime.now(UTC) - ACTIVE_WINDOW
    active_users = await db.attempts.distinct("user_id", {"created_at": {"$gte": active_since}})

    courses = []
    for subject in await subject_service.list_subjects(include_archived=True):
        courses.append(
            CourseStats(
                slug=subject.slug,
                name=subject.name,
                archived=subject.archived,
                topics=await db.topics.count_documents({"subject": subject.slug, "archived": {"$ne": True}}),
                learners=await db.users.count_documents(_learners_query(subject.slug)),
            )
        )

    return AdminStats(
        users=await db.users.count_documents({}),
        active_last_7_days=len(active_users),
        questions_answered=await db.attempts.count_documents({"counted_in_progress": True}),
        tests_submitted=await db.final_tests.count_documents({"submitted_at": {"$ne": None}}),
        courses=courses,
    )


async def list_users() -> list[AdminUserRow]:
    db = get_database()
    activity = await db.attempts.aggregate(
        [
            {
                "$group": {
                    "_id": "$user_id",
                    "answered": {"$sum": {"$cond": ["$counted_in_progress", 1, 0]}},
                    "last_active": {"$max": "$created_at"},
                }
            }
        ]
    )
    by_user = {row["_id"]: row async for row in activity}
    admins = get_settings().admin_email_set

    rows = []
    async for user in db.users.find().sort("created_at", -1).limit(USER_LIST_LIMIT):
        user_id = str(user["_id"])
        stats = by_user.get(user_id, {})
        rows.append(
            AdminUserRow(
                id=user_id,
                name=user["name"],
                email=user["email"],
                is_admin=user["email"].lower() in admins,
                subjects=user.get("subjects") or [subject_service.DEFAULT_SUBJECT],
                questions_answered=stats.get("answered", 0),
                last_active=stats.get("last_active"),
                created_at=user["created_at"],
            )
        )
    return rows


# ---------- Courses ----------


def _course(document: dict) -> AdminCourse:
    return AdminCourse(
        slug=document["slug"],
        name=document["name"],
        description=document["description"],
        language=document["language"],
        archived=document.get("archived", False),
        order=document.get("order", 0),
    )


async def list_courses() -> list[AdminCourse]:
    cursor = get_database().subjects.find({"deleted": {"$ne": True}}).sort("order", 1)
    return [_course(document) async for document in cursor]


async def create_course(data: CourseIn) -> AdminCourse:
    db = get_database()
    slug = slugify(data.name)
    if not slug:
        raise AppError("Use letters or numbers in the course name.")
    # A previously deleted course with the same name leaves a marker behind; replace it.
    await db.subjects.delete_one({"slug": slug, "deleted": True})
    last = await db.subjects.find_one(sort=[("order", -1)])
    document = {**data.model_dump(), "slug": slug, "order": (last["order"] + 1) if last else 1, "created_at": datetime.now(UTC)}
    try:
        await db.subjects.insert_one(document)
    except DuplicateKeyError as exc:
        raise ConflictError(f"A course with the slug '{slug}' already exists.") from exc
    return _course(document)


async def update_course(slug: str, data: CourseIn) -> AdminCourse:
    document = await get_database().subjects.find_one_and_update(
        {"slug": slug}, {"$set": data.model_dump()}, return_document=ReturnDocument.AFTER
    )
    if document is None:
        raise NotFoundError("Course not found.")
    return _course(document)


def _learners_query(slug: str) -> dict:
    query: dict = {"subjects": slug}
    if slug == subject_service.DEFAULT_SUBJECT:
        # Accounts with no stored plan are on the default course.
        query = {"$or": [query, {"subjects": {"$in": [None, []]}}, {"subjects": {"$exists": False}}]}
    return query


async def preview_course_deletion(slug: str) -> CourseDeletePreview:
    db = get_database()
    subject = await subject_service.get_subject(slug)
    topic_slugs = await db.topics.distinct("slug", {"subject": slug})
    is_default = slug == subject_service.DEFAULT_SUBJECT
    return CourseDeletePreview(
        slug=slug,
        name=subject.name,
        topics=len(topic_slugs),
        learners=await db.users.count_documents(_learners_query(slug)),
        answers=await db.attempts.count_documents({"topic_slug": {"$in": topic_slugs}}),
        can_delete=not is_default,
        reason="New accounts start on this course, so it can't be deleted. You can archive it instead." if is_default else None,
    )


async def delete_course(slug: str) -> None:
    """Permanently remove a course, its topics, and all learner data for it.

    A small marker document is kept so the startup seed doesn't recreate a built-in course.
    """
    preview = await preview_course_deletion(slug)
    if not preview.can_delete:
        raise AppError(preview.reason or "This course can't be deleted.")

    db = get_database()
    topic_slugs = await db.topics.distinct("slug", {"subject": slug})
    in_topics = {"topic_slug": {"$in": topic_slugs}}
    for collection in (
        db.topic_progress, db.attempts, db.questions, db.sessions, db.topic_materials, db.course_notes
    ):
        await collection.delete_many(in_topics)
    await db.final_tests.delete_many({"$or": [in_topics, {"scope": "course", "subject_slug": slug}]})
    await db.course_progress.delete_many({"subject_slug": slug})
    await db.feedback_reports.delete_many({"subject_slug": slug})
    await db.topics.delete_many({"subject": slug})

    # Learners keep their other courses; anyone left with none falls back to the default course.
    await db.users.update_many({"subjects": slug}, {"$pull": {"subjects": slug}})
    await db.users.update_many({"current_subject": slug}, {"$set": {"current_subject": None}})
    await db.subjects.update_one(
        {"slug": slug}, {"$set": {"deleted": True, "archived": True, "deleted_at": datetime.now(UTC)}}
    )


# ---------- Topics ----------


def _topic(document: dict) -> AdminTopic:
    return AdminTopic(
        slug=document["slug"],
        subject=document["subject"],
        name=document["name"],
        description=document["description"],
        key_concepts=document["key_concepts"],
        order=document["order"],
        archived=document.get("archived", False),
    )


async def list_topics(subject_slug: str) -> list[AdminTopic]:
    cursor = get_database().topics.find({"subject": subject_slug}).sort("order", 1)
    return [_topic(document) async for document in cursor]


async def create_topic(data: TopicCreate) -> AdminTopic:
    db = get_database()
    await subject_service.get_subject(data.subject_slug)
    # Topic slugs are unique across courses, so they're prefixed with the course.
    slug = f"{data.subject_slug}-{slugify(data.name)}"
    last = await db.topics.find_one({"subject": data.subject_slug}, sort=[("order", -1)])
    document = {
        **data.model_dump(exclude={"subject_slug"}),
        "slug": slug,
        "subject": data.subject_slug,
        "order": (last["order"] + 1) if last else 1,
        "created_at": datetime.now(UTC),
    }
    try:
        await db.topics.insert_one(document)
    except DuplicateKeyError as exc:
        raise ConflictError(f"A topic with the slug '{slug}' already exists. Try a different name.") from exc
    return _topic(document)


async def update_topic(slug: str, data: TopicIn) -> AdminTopic:
    document = await get_database().topics.find_one_and_update(
        {"slug": slug}, {"$set": data.model_dump()}, return_document=ReturnDocument.AFTER
    )
    if document is None:
        raise NotFoundError("Topic not found.")
    return _topic(document)


async def move_topic(slug: str, direction: str) -> list[AdminTopic]:
    """Swap a topic's position with its neighbour in the course order."""
    db = get_database()
    topic = await db.topics.find_one({"slug": slug})
    if topic is None:
        raise NotFoundError("Topic not found.")
    comparison, sort = ("$lt", -1) if direction == "up" else ("$gt", 1)
    neighbour = await db.topics.find_one(
        {"subject": topic["subject"], "order": {comparison: topic["order"]}}, sort=[("order", sort)]
    )
    if neighbour is not None:
        await db.topics.update_one({"_id": topic["_id"]}, {"$set": {"order": neighbour["order"]}})
        await db.topics.update_one({"_id": neighbour["_id"]}, {"$set": {"order": topic["order"]}})
    return await list_topics(topic["subject"])