"""Timed final tests.

Unlike practice and quizzes, nothing is revealed while the test is running. Answers are autosaved,
and everything is graded together when the learner submits or the time runs out. Final test
questions are multiple choice or predict-the-output, so grading is instant and needs no AI call.
"""

from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.core.exceptions import ConflictError, NotFoundError
from app.db.mongodb import get_database, to_object_id
from app.models.enums import LearningMode
from app.models.final_test import ConceptScore, FinalTest, FinalTestResult, QuestionReview
from app.models.question import Question
from app.models.user import User
from app.prompts.tutor_prompt import build_final_test_prompt, build_system_prompt
from app.schemas.final_test import FinalTestOut
from app.schemas.quiz import QuizResponse
from app.schemas.tutor import QuestionOut
from app.services import (
    evaluation_service,
    progress_service,
    question_service,
    recommendation_service,
    topic_service,
    tutor_service,
)
from app.services.ai_service import StructuredLLM

FINAL_TEST_LENGTH = 10
SECONDS_PER_QUESTION = 90
# Covers network delay when the browser submits automatically at 0:00.
SUBMIT_GRACE_SECONDS = 15
STRONG_CONCEPT_RATIO = 0.75
# Finishing in under this share of the time with a low score suggests rushing.
RUSHED_TIME_RATIO = 0.25


# ---------- Starting and loading ----------


async def start_final_test(user: User, topic_slug: str, ai: StructuredLLM) -> FinalTest:
    topic = await topic_service.get_topic(topic_slug)
    difficulty = await progress_service.get_current_difficulty(user, topic_slug)
    context = await tutor_service.build_learner_context(user, topic_slug, difficulty, LearningMode.FINAL_TEST)
    recent_prompts = await question_service.get_recent_prompts(user.id, topic_slug)

    generated = await ai.generate_structured(
        system_prompt=build_system_prompt(context),
        user_prompt=build_final_test_prompt(FINAL_TEST_LENGTH, recent_prompts),
        response_model=QuizResponse,
    )
    items = generated.questions[:FINAL_TEST_LENGTH]
    for item in items:
        tutor_service.align_concept(item, topic.key_concepts)

    # The id is created first because each question stores it as its session_id.
    test_id = ObjectId()
    questions = await question_service.save_questions(
        user_id=user.id,
        session_id=str(test_id),
        topic_slug=topic_slug,
        mode=LearningMode.FINAL_TEST,
        difficulty=difficulty,
        generated=items,
    )

    # The clock starts once the questions are ready, not while they're being generated.
    now = datetime.now(UTC)
    document = {
        "_id": test_id,
        "user_id": user.id,
        "topic_slug": topic_slug,
        "difficulty": difficulty.value,
        "question_ids": [question.id for question in questions],
        "answers": {},
        "time_limit_seconds": len(questions) * SECONDS_PER_QUESTION,
        "started_at": now,
        "submitted_at": None,
        "result": None,
        "created_at": now,
    }
    await get_database().final_tests.insert_one(document)
    return FinalTest.from_document(document)


async def get_final_test(user_id: str, test_id: str) -> FinalTest:
    object_id = to_object_id(test_id)
    document = None
    if object_id is not None:
        document = await get_database().final_tests.find_one({"_id": object_id, "user_id": user_id})
    if document is None:
        raise NotFoundError("Final test not found.")
    return FinalTest.from_document(document)


async def load_final_test(user: User, test_id: str) -> FinalTest:
    """Return the test, finishing it first if its time ran out while the learner was away."""
    test = await get_final_test(user.id, test_id)
    if test.submitted_at is None and datetime.now(UTC) > _closes_at(test):
        return await _finalize(user, test, test.answers, finished_by="time_up")
    return test


# ---------- Answering and submitting ----------


async def save_answer(user: User, test_id: str, question_id: str, answer: str) -> None:
    test = await get_final_test(user.id, test_id)
    if test.submitted_at is not None or datetime.now(UTC) > _closes_at(test):
        raise ConflictError("This test has already finished.")
    if question_id not in test.question_ids:
        raise NotFoundError("Question not found in this test.")
    # Safe as a field path: question ids are ObjectId hex strings (checked above).
    await get_database().final_tests.update_one(
        {"_id": to_object_id(test.id)}, {"$set": {f"answers.{question_id}": answer}}
    )


async def submit_final_test(user: User, test_id: str, latest_answers: dict[str, str]) -> FinalTest:
    test = await get_final_test(user.id, test_id)
    if test.submitted_at is not None:
        return test  # Already finished (e.g. auto-submit and a click arriving together).

    now = datetime.now(UTC)
    answers = dict(test.answers)
    if now <= _closes_at(test):
        answers.update({qid: answer for qid, answer in latest_answers.items() if qid in test.question_ids})
    finished_by = "time_up" if now > _deadline(test) else "submitted"
    return await _finalize(user, test, answers, finished_by)


# ---------- Grading and analysis ----------


def _deadline(test: FinalTest) -> datetime:
    return test.started_at + timedelta(seconds=test.time_limit_seconds)


def _closes_at(test: FinalTest) -> datetime:
    return _deadline(test) + timedelta(seconds=SUBMIT_GRACE_SECONDS)


def grade_final_answer(question: Question, answer: str) -> bool:
    if not answer.strip():
        return False
    graded = evaluation_service.grade_deterministically(question, answer)
    if graded is not None:
        return graded
    # The prompt asks for auto-gradable types only; this handles the rare short answer that slips through.
    normalize = evaluation_service.normalize_output
    return normalize(answer).lower() == normalize(question.correct_answer).lower()


async def _finalize(user: User, test: FinalTest, answers: dict[str, str], finished_by: str) -> FinalTest:
    now = datetime.now(UTC)
    # Claim the test atomically so two simultaneous submits can't record progress twice.
    claimed = await get_database().final_tests.update_one(
        {"_id": to_object_id(test.id), "submitted_at": None},
        {"$set": {"submitted_at": now, "answers": answers}},
    )
    if claimed.modified_count == 0:
        return await get_final_test(user.id, test.id)

    questions = await question_service.get_questions(user.id, test.question_ids)
    reviews = [_review(question, answers.get(question.id, "")) for question in questions]

    for question, review in zip(questions, reviews, strict=True):
        await progress_service.record_attempt(user, question, review.your_answer, review.correct, 100 if review.correct else 0)
        await question_service.record_question_attempt(question.id, review.correct)

    topic = await topic_service.get_topic(test.topic_slug)
    time_taken = min(int((now - test.started_at).total_seconds()), test.time_limit_seconds)
    result = analyze_results(reviews, time_taken, test.time_limit_seconds, finished_by, topic.name)
    await get_database().final_tests.update_one(
        {"_id": to_object_id(test.id)}, {"$set": {"result": result.model_dump()}}
    )
    return await get_final_test(user.id, test.id)


def _review(question: Question, answer: str) -> QuestionReview:
    return QuestionReview(
        question_id=question.id,
        prompt=question.prompt,
        code=question.code,
        options=question.options,
        question_type=question.question_type.value,
        concept=question.concept,
        your_answer=answer.strip(),
        correct_answer=question.correct_answer,
        explanation=question.explanation,
        correct=grade_final_answer(question, answer),
    )


def analyze_results(
    reviews: list[QuestionReview], time_taken: int, time_limit: int, finished_by: str, topic_name: str
) -> FinalTestResult:
    total = len(reviews)
    correct = sum(review.correct for review in reviews)
    accuracy = progress_service.calculate_accuracy(correct, total)

    by_concept: dict[str, ConceptScore] = {}
    for review in reviews:
        score = by_concept.setdefault(review.concept, ConceptScore(concept=review.concept, correct=0, total=0))
        score.total += 1
        score.correct += int(review.correct)
    concept_scores = list(by_concept.values())

    return FinalTestResult(
        correct=correct,
        total=total,
        accuracy=accuracy,
        time_taken_seconds=time_taken,
        finished_by=finished_by,
        concept_scores=concept_scores,
        strong_areas=[s.concept for s in concept_scores if s.correct / s.total >= STRONG_CONCEPT_RATIO],
        needs_practice=[s.concept for s in concept_scores if s.correct / s.total < STRONG_CONCEPT_RATIO],
        remarks=_result_remarks(reviews, accuracy, time_taken, time_limit, finished_by, topic_name),
        review=reviews,
    )


def _result_remarks(
    reviews: list[QuestionReview],
    accuracy: float,
    time_taken: int,
    time_limit: int,
    finished_by: str,
    topic_name: str,
) -> list[str]:
    if accuracy >= 90:
        remarks = [f"Excellent result. You have a strong command of {topic_name}."]
    elif accuracy >= 70:
        remarks = ["Good result. Review the concepts under Needs practice to close the remaining gaps."]
    elif accuracy >= 50:
        remarks = ["You're partway there. Revisit the missed concepts in Learn mode, then practice them before retaking the test."]
    else:
        remarks = ["This topic needs more work. Start with a Learn session on the missed concepts, then build up with practice questions."]

    unanswered = sum(1 for review in reviews if not review.your_answer)
    if finished_by == "time_up":
        remarks.append("Time ran out before you submitted, so your saved answers were graded.")
    if unanswered:
        remarks.append(f"{unanswered} question{'s were' if unanswered != 1 else ' was'} left unanswered and counted as incorrect.")
    if accuracy < 70 and time_limit and time_taken < time_limit * RUSHED_TIME_RATIO:
        remarks.append("You finished very quickly. Taking more time on each question could raise your score.")
    return remarks


# ---------- Response ----------


async def build_final_test_out(user: User, test: FinalTest) -> FinalTestOut:
    topic = await topic_service.get_topic(test.topic_slug)
    questions = await question_service.get_questions(user.id, test.question_ids)
    submitted = test.submitted_at is not None
    seconds_remaining = 0
    if not submitted:
        seconds_remaining = max(0, int((_deadline(test) - datetime.now(UTC)).total_seconds()))

    return FinalTestOut(
        id=test.id,
        topic_slug=test.topic_slug,
        topic_name=topic.name,
        difficulty=test.difficulty,
        questions=[QuestionOut.from_question(question) for question in questions],
        answers=test.answers,
        time_limit_seconds=test.time_limit_seconds,
        seconds_remaining=seconds_remaining,
        started_at=test.started_at,
        submitted=submitted,
        result=test.result,
        recommendation=await recommendation_service.recommend_next_topic(user) if submitted else None,
    )