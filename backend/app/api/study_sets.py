from fastapi import APIRouter, Request, Response, status
from fastapi.responses import FileResponse, RedirectResponse

from app.core.dependencies import AIDependency, CurrentUser
from app.schemas.study_set import (
    FlashcardProgress,
    MaterialAdded,
    MaterialIn,
    MoreFlashcards,
    QuizResult,
    StudyChatReply,
    StudyChatRequest,
    StudySetCreate,
    StudySetCreated,
    StudySetOut,
    StudySetSummary,
)
from app.services import study_set_service

router = APIRouter(prefix="/api/study-sets", tags=["study sets"])


@router.get("", response_model=list[StudySetSummary])
async def list_study_sets(user: CurrentUser) -> list[StudySetSummary]:
    return await study_set_service.list_study_sets(user)


@router.post("", response_model=StudySetCreated, status_code=status.HTTP_201_CREATED)
async def create_study_set(data: StudySetCreate, user: CurrentUser) -> StudySetCreated:
    """Create a study set from a file's text (read in the browser). The response says where to
    upload the original file."""
    return await study_set_service.create_study_set(user, data)


@router.get("/{set_id}", response_model=StudySetOut)
async def get_study_set(set_id: str, user: CurrentUser) -> StudySetOut:
    return await study_set_service.get_study_set(user, set_id)


@router.delete("/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study_set(set_id: str, user: CurrentUser) -> None:
    """Delete the study set, its stored file, and everything generated from it."""
    await study_set_service.delete_study_set(user, set_id)


@router.post("/{set_id}/materials", response_model=MaterialAdded, status_code=status.HTTP_201_CREATED)
async def add_material(set_id: str, data: MaterialIn, user: CurrentUser) -> MaterialAdded:
    """Add another file to the set (up to 2 GB for all its files). Existing notes, summary,
    flashcards and quiz are marked as made before this file, so they can be updated."""
    return await study_set_service.add_material(user, set_id, data)


@router.put("/{set_id}/materials/{material_id}/file", response_model=StudySetOut)
async def upload_material_file(set_id: str, material_id: str, request: Request, user: CurrentUser) -> StudySetOut:
    """Local storage only: the original file as the raw request body, streamed to disk."""
    return await study_set_service.receive_material_file(user, set_id, material_id, request.stream())


@router.post("/{set_id}/materials/{material_id}/complete", response_model=StudySetOut)
async def complete_material_upload(set_id: str, material_id: str, user: CurrentUser) -> StudySetOut:
    """S3 only: confirm the browser finished uploading with its presigned link."""
    return await study_set_service.complete_material_upload(user, set_id, material_id)


@router.delete("/{set_id}/materials/{material_id}", response_model=StudySetOut)
async def remove_material(set_id: str, material_id: str, user: CurrentUser) -> StudySetOut:
    return await study_set_service.remove_material(user, set_id, material_id)


@router.post("/{set_id}/tools/{tool}", response_model=StudySetOut)
async def generate_tool(
    set_id: str, tool: str, user: CurrentUser, ai: AIDependency, regenerate: bool = False
) -> StudySetOut:
    """Notes, summary, flashcards or quiz: generated on first use, then saved."""
    return await study_set_service.generate_tool(user, set_id, tool, ai, regenerate)


@router.post("/{set_id}/flashcards/more", response_model=MoreFlashcards)
async def add_flashcards(set_id: str, user: CurrentUser, ai: AIDependency) -> MoreFlashcards:
    """New cards that don't repeat the deck's existing ones, added to the deck."""
    study_set, new_ids = await study_set_service.add_flashcards(user, set_id, ai)
    return MoreFlashcards(study_set=study_set, new_card_ids=new_ids)


@router.put("/{set_id}/flashcards/progress", response_model=StudySetOut)
async def save_flashcard_progress(set_id: str, data: FlashcardProgress, user: CurrentUser) -> StudySetOut:
    return await study_set_service.save_flashcard_progress(user, set_id, data.known_card_ids)


@router.post("/{set_id}/quiz-result", response_model=StudySetOut)
async def save_quiz_result(set_id: str, data: QuizResult, user: CurrentUser) -> StudySetOut:
    return await study_set_service.save_quiz_result(user, set_id, data)


@router.post("/{set_id}/chat", response_model=StudyChatReply)
async def chat(set_id: str, data: StudyChatRequest, user: CurrentUser, ai: AIDependency) -> StudyChatReply:
    return await study_set_service.chat(user, set_id, data.message, ai)


@router.get("/{set_id}/download", response_model=None)
async def download_original(set_id: str, user: CurrentUser, material_id: str | None = None) -> Response:
    """An original file (the first one unless material_id is given): a redirect to a short-lived S3
    link, or the file streamed from disk with local storage."""
    url, path, material = await study_set_service.download_link(user, set_id, material_id)
    if url:
        return RedirectResponse(url)
    return FileResponse(
        path,
        media_type=material["content_type"] or "application/octet-stream",
        filename=material["file_name"],
    )