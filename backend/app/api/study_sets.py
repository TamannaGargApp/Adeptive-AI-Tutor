from fastapi import APIRouter, Response, status
from fastapi.responses import RedirectResponse

from app.core.dependencies import AIDependency, CurrentUser
from app.schemas.study_set import (
    FlashcardProgress,
    MoreFlashcards,
    QuizResult,
    StudyChatReply,
    StudyChatRequest,
    StudySetCreate,
    StudySetOut,
    StudySetSummary,
)
from app.services import study_set_service

router = APIRouter(prefix="/api/study-sets", tags=["study sets"])


@router.get("", response_model=list[StudySetSummary])
async def list_study_sets(user: CurrentUser) -> list[StudySetSummary]:
    return await study_set_service.list_study_sets(user)


@router.post("", response_model=StudySetSummary, status_code=status.HTTP_201_CREATED)
async def create_study_set(data: StudySetCreate, user: CurrentUser) -> StudySetSummary:
    """Create a study set from a file read in the browser (its text, plus the original for storage)."""
    return await study_set_service.create_study_set(user, data)


@router.get("/{set_id}", response_model=StudySetOut)
async def get_study_set(set_id: str, user: CurrentUser) -> StudySetOut:
    return await study_set_service.get_study_set(user, set_id)


@router.delete("/{set_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study_set(set_id: str, user: CurrentUser) -> None:
    """Delete the study set, its stored file, and everything generated from it."""
    await study_set_service.delete_study_set(user, set_id)


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
async def download_original(set_id: str, user: CurrentUser) -> Response:
    """The original file: a redirect to a short-lived S3 link, or the file itself with local storage."""
    url, data, document = await study_set_service.download_link(user, set_id)
    if url:
        return RedirectResponse(url)
    file_name = document["file_name"].replace('"', "")
    return Response(
        content=data,
        media_type=document["content_type"] or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )