from fastapi import APIRouter, status

from app.core.dependencies import AIDependency, CurrentUser
from app.schemas.auth import MessageResponse
from app.schemas.final_test import (
    AnswerSave,
    FinalTestCreate,
    FinalTestOut,
    FinalTestSubmit,
    QuestionStatusUpdate,
)
from app.services import final_test_service

router = APIRouter(prefix="/api/final-tests", tags=["final tests"])


@router.post("", response_model=FinalTestOut, status_code=status.HTTP_201_CREATED)
async def start_final_test(data: FinalTestCreate, user: CurrentUser, ai: AIDependency) -> FinalTestOut:
    if data.subject_slug:
        test = await final_test_service.start_course_exam(user, data.subject_slug, ai)
    else:
        test = await final_test_service.start_topic_test(user, data.topic_slug or "", ai)
    return await final_test_service.build_final_test_out(user, test)


@router.get("/{test_id}", response_model=FinalTestOut)
async def get_final_test(test_id: str, user: CurrentUser) -> FinalTestOut:
    test = await final_test_service.load_final_test(user, test_id)
    return await final_test_service.build_final_test_out(user, test)


@router.put("/{test_id}/answers", response_model=MessageResponse)
async def save_answer(test_id: str, data: AnswerSave, user: CurrentUser) -> MessageResponse:
    await final_test_service.save_answer(user, test_id, data.question_id, data.answer)
    return MessageResponse(message="Saved.")


@router.put("/{test_id}/status", response_model=MessageResponse)
async def update_question_status(test_id: str, data: QuestionStatusUpdate, user: CurrentUser) -> MessageResponse:
    """Mark a question for review, or record that it was opened (used to show skipped questions)."""
    await final_test_service.update_question_status(user, test_id, data)
    return MessageResponse(message="Saved.")


@router.post("/{test_id}/submit", response_model=FinalTestOut)
async def submit_final_test(test_id: str, data: FinalTestSubmit, user: CurrentUser) -> FinalTestOut:
    test = await final_test_service.submit_final_test(user, test_id, data.answers)
    return await final_test_service.build_final_test_out(user, test)