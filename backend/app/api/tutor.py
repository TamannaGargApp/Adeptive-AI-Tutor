from fastapi import APIRouter, status

from app.core.dependencies import AIDependency, CurrentUser
from app.schemas.quiz import QuizOut, QuizRequest, QuizResult
from app.schemas.tutor import (
    EvaluateRequest,
    EvaluationResult,
    LearnReply,
    LearnRequest,
    PracticeRequest,
    QuestionOut,
)
from app.services import evaluation_service, tutor_service

router = APIRouter(prefix="/api/tutor", tags=["tutor"])


@router.post("/learn", response_model=LearnReply)
async def learn(data: LearnRequest, user: CurrentUser, ai: AIDependency) -> LearnReply:
    return await tutor_service.teach(user, data.session_id, data.message, ai)


@router.post("/practice", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def practice(data: PracticeRequest, user: CurrentUser, ai: AIDependency) -> QuestionOut:
    question = await tutor_service.generate_practice_question(user, data.session_id, ai)
    return QuestionOut.from_question(question)


@router.post("/evaluate", response_model=EvaluationResult)
async def evaluate(data: EvaluateRequest, user: CurrentUser, ai: AIDependency) -> EvaluationResult:
    return await evaluation_service.evaluate_submission(user, data, ai)


@router.post("/quiz", response_model=QuizOut)
async def create_quiz(data: QuizRequest, user: CurrentUser, ai: AIDependency) -> QuizOut:
    session, questions = await tutor_service.generate_quiz(user, data.session_id, ai)
    return QuizOut(
        session_id=session.id,
        topic_slug=session.topic_slug,
        difficulty=session.difficulty,
        questions=[QuestionOut.from_question(question) for question in questions],
    )


@router.get("/quiz/{session_id}/result", response_model=QuizResult)
async def get_quiz_result(session_id: str, user: CurrentUser) -> QuizResult:
    return await evaluation_service.build_quiz_result(user, session_id)
