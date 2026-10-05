from fastapi import APIRouter, status

from app.core.dependencies import AdminUser, AIDependency
from app.schemas.admin import (
    AdminCourse,
    AdminStats,
    AdminTopic,
    AdminUserRow,
    CourseDeletePreview,
    CourseIn,
    TopicCreate,
    TopicIn,
    TopicMove,
)
from app.schemas.material import TopicMaterialIn, TopicMaterialOut
from app.schemas.notes import CourseNotesFile, NotesUpload
from app.services import admin_service, material_service, notes_service

# Every route requires an administrator (see ADMIN_EMAILS in .env).
router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
async def get_stats(_: AdminUser) -> AdminStats:
    return await admin_service.get_stats()


@router.get("/users", response_model=list[AdminUserRow])
async def list_users(_: AdminUser) -> list[AdminUserRow]:
    return await admin_service.list_users()


@router.get("/courses", response_model=list[AdminCourse])
async def list_courses(_: AdminUser) -> list[AdminCourse]:
    return await admin_service.list_courses()


@router.post("/courses", response_model=AdminCourse, status_code=status.HTTP_201_CREATED)
async def create_course(data: CourseIn, _: AdminUser) -> AdminCourse:
    return await admin_service.create_course(data)


@router.put("/courses/{slug}", response_model=AdminCourse)
async def update_course(slug: str, data: CourseIn, _: AdminUser) -> AdminCourse:
    return await admin_service.update_course(slug, data)


@router.get("/courses/{slug}/delete-preview", response_model=CourseDeletePreview)
async def preview_course_deletion(slug: str, _: AdminUser) -> CourseDeletePreview:
    return await admin_service.preview_course_deletion(slug)


@router.delete("/courses/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(slug: str, _: AdminUser) -> None:
    """Permanently delete a course and all learner data for it. Ask for confirmation first."""
    await admin_service.delete_course(slug)


@router.get("/courses/{slug}/topics", response_model=list[AdminTopic])
async def list_topics(slug: str, _: AdminUser) -> list[AdminTopic]:
    return await admin_service.list_topics(slug)


@router.post("/topics", response_model=AdminTopic, status_code=status.HTTP_201_CREATED)
async def create_topic(data: TopicCreate, _: AdminUser) -> AdminTopic:
    return await admin_service.create_topic(data)


@router.put("/topics/{slug}", response_model=AdminTopic)
async def update_topic(slug: str, data: TopicIn, _: AdminUser) -> AdminTopic:
    return await admin_service.update_topic(slug, data)


@router.put("/topics/{slug}/material", response_model=TopicMaterialOut)
async def update_material(slug: str, data: TopicMaterialIn, _: AdminUser) -> TopicMaterialOut:
    return await material_service.update_material(slug, data)


@router.post("/topics/{slug}/material/regenerate", response_model=TopicMaterialOut)
async def regenerate_material(slug: str, _: AdminUser, ai: AIDependency) -> TopicMaterialOut:
    return await material_service.regenerate_material(slug, ai)


@router.get("/topics/{slug}/notes", response_model=list[CourseNotesFile])
async def list_course_notes(slug: str, _: AdminUser) -> list[CourseNotesFile]:
    return await notes_service.list_notes(slug)


@router.post("/topics/{slug}/notes", response_model=CourseNotesFile, status_code=status.HTTP_201_CREATED)
async def upload_course_notes(slug: str, data: NotesUpload, admin: AdminUser) -> CourseNotesFile:
    """Add notes for a topic (text extracted in the browser). The tutor uses them alongside its own knowledge."""
    return await notes_service.add_notes(slug, data, uploaded_by=admin.email)


@router.delete("/notes/{notes_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course_notes(notes_id: str, _: AdminUser) -> None:
    await notes_service.delete_notes(notes_id)


@router.post("/topics/{slug}/move", response_model=list[AdminTopic])
async def move_topic(slug: str, data: TopicMove, _: AdminUser) -> list[AdminTopic]:
    return await admin_service.move_topic(slug, data.direction)