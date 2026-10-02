"""Answer evaluation.

Multiple choice and predict-output answers are graded in code, so correctness never depends on
the AI (and can't be talked into "correct" by the learner's answer). The AI only writes feedback
for those, and grades short-answer questions where exact matching isn't possible.
"""

import logging
from collections.abc import Iterable

from app.core.exceptions import AIServiceError, ConflictError
from app.models.enums import LearningMode, QuestionType
from app.models.question import Question
from app.models.user import User
from app.prompts.tutor_prompt import build_evaluation_prompt, build_system_prompt
from app.schemas.progress import RecommendationResponse
from app.schemas.quiz import QuizResult
from app.schemas.tutor import EvaluateRequest, EvaluationResponse, EvaluationResult
from app.services import (
    progress_service,
    question_service,
    recommendation_service,
    session_service,
    tutor_service,
)
from app.services.ai_service import StructuredLLM

logger = logging.getLogger(__name__)

# In practice mode, the answer is revealed after this many wrong attempts.
ATTEMPTS_BEFORE_REVEAL = 3


def normalize_output(text: str) -> str:
    """Compare program output ignoring spacing differences, so "0 1 2" matches "0\\n1\\n2"."""
    return " ".join(text.split())


def grade_deterministically(question: Question, answer: str) -> bool | None:
    """Return True/False when the answer can be checked exactly, or None if the AI must grade it."""
    if question.question_type == QuestionType.MULTIPLE_CHOICE:
        return normalize_output(answer).lower() == normalize_output(question.correct_answer).lower()
    if question.question_type == QuestionType.PREDICT_OUTPUT:
        return normalize_output(answer) == normalize_output(question.correct_answer)
    return None


def should_reveal_answer(question: Question, correct: bool | None, attempt_number: int) -> bool:
    return bool(correct) or question.mode == LearningMode.QUIZ or attempt_number >= ATTEMPTS_BEFORE_REVEAL


def fallback_feedback(question: Question, correct: bool, reveal: bool) -> EvaluationResponse:
    """Used when the AI is unavailable but the answer could still be graded in code."""
    if correct:
        feedback = "Correct! Nice work."
    elif reveal:
        feedback = f"Not quite. {question.explanation}"
    else:
        feedback = "Not quite yet. Have another look and try again."
    return EvaluationResponse(
        correct=correct,
        score=100 if correct else 0,
        feedback=feedback,
        hint=None if correct or question.mode == LearningMode.QUIZ else question.hint,
        correct_answer=question.correct_answer if reveal else None,
        concept=question.concept,
        difficulty=question.difficulty.value,
    )


async def evaluate_submission(user: User, request: EvaluateRequest, ai: StructuredLLM) -> EvaluationResult:
    question = await question_service.get_question(user.id, request.question_id)
    _ensure_can_answer(question)

    answer = request.answer.strip()
    attempt_number = question.attempt_count + 1
    known_correct = grade_deterministically(question, answer)
    reveal = should_reveal_answer(question, known_correct, attempt_number)

    ai_result = await _get_ai_feedback(ai, user, question, answer, known_correct, attempt_number, reveal)
    correct = known_correct if known_correct is not None else ai_result.correct
    score = (100 if correct else 0) if known_correct is not None else ai_result.score
    reveal = reveal or correct

    progress_update = await progress_service.record_attempt(user, question, answer, correct, score)
    await question_service.record_question_attempt(question.id, correct)
    if progress_update.difficulty_changed:
        await session_service.update_difficulty(question.session_id, progress_update.next_difficulty)

    return EvaluationResult(
        question_id=question.id,
        correct=correct,
        score=score,
        feedback=ai_result.feedback,
        # Quizzes allow one attempt and always show the answer with its explanation,
        # so a hint would have nothing left to point toward.
        hint=None if correct or question.mode == LearningMode.QUIZ else (ai_result.hint or question.hint),
        correct_answer=question.correct_answer if reveal else None,
        explanation=question.explanation if reveal else None,
        concept=question.concept,
        difficulty=question.difficulty,
        attempt_number=attempt_number,
        can_retry=not correct and question.mode == LearningMode.PRACTICE,
        next_difficulty=progress_update.next_difficulty,
        difficulty_changed=progress_update.difficulty_changed,
    )


def _ensure_can_answer(question: Question) -> None:
    if question.mode == LearningMode.QUIZ and question.attempt_count > 0:
        raise ConflictError("You've already answered this quiz question.")
    if question.solved:
        raise ConflictError("You've already solved this question. Ask for a new one!")


async def _get_ai_feedback(
    ai: StructuredLLM,
    user: User,
    question: Question,
    answer: str,
    known_correct: bool | None,
    attempt_number: int,
    reveal: bool,
) -> EvaluationResponse:
    session = await session_service.get_session(user.id, question.session_id)
    context = await tutor_service.build_learner_context(user, session)
    try:
        return await ai.generate_structured(
            system_prompt=build_system_prompt(context),
            user_prompt=build_evaluation_prompt(question, answer, known_correct, attempt_number, reveal),
            response_model=EvaluationResponse,
        )
    except AIServiceError:
        if known_correct is None:
            raise  # Short answers can't be graded without the AI.
        logger.warning("AI feedback unavailable, using fallback feedback for question %s", question.id)
        return fallback_feedback(question, known_correct, reveal)


async def build_quiz_result(user: User, session_id: str) -> QuizResult:
    session = await session_service.get_session_in_mode(user.id, session_id, LearningMode.QUIZ)
    questions = await question_service.get_questions(user.id, session.quiz_question_ids)

    answered = [question for question in questions if question.attempt_count > 0]
    correct = [question for question in answered if question.solved]
    missed_concepts = _unique(question.concept for question in answered if not question.solved)
    strong_concepts = [
        concept for concept in _unique(question.concept for question in correct) if concept not in missed_concepts
    ]
    recommendation: RecommendationResponse = await recommendation_service.recommend_next_topic(user)

    return QuizResult(
        session_id=session.id,
        topic_slug=session.topic_slug,
        total_questions=len(questions),
        answered=len(answered),
        correct=len(correct),
        accuracy=progress_service.calculate_accuracy(len(correct), len(questions)),
        strong_areas=strong_concepts,
        needs_practice=missed_concepts,
        recommendation=recommendation,
    )


def _unique(items: Iterable[str]) -> list[str]:
    seen: dict[str, None] = {}
    for item in items:
        seen.setdefault(item, None)
    return list(seen)