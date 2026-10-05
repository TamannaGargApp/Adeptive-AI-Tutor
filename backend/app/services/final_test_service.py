"""Timed final tests: topic tests and course exams.

Unlike practice and quizzes, nothing is revealed while a test is running. Answers are autosaved,
and everything is graded together when the learner submits or the time runs out. Test questions
are multiple choice or predict-the-output, so grading is instant and needs no AI call.

- A topic test covers one topic (10 questions).
- A course exam covers every topic of a course (2 questions per topic).
"""

from collections import defaultdict
from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.core.exceptions import AIServiceError, ConflictError, NotFoundError
from app.db.mongodb import get_database, to_object_id
from app.models.enums import LearningMode, Level
from app.models.final_test import ConceptScore, FinalTest, FinalTestResult, QuestionReview, TopicScore
from app.models.question import Question
from app.models.user import User
from app.prompts.tutor_prompt import (
    build_course_exam_prompt,
    build_course_exam_system_prompt,
    build_final_test_prompt,
    build_system_prompt,
)
from app.schemas.final_test import CourseExamResponse, FinalTestOut, QuestionStatusUpdate
from app.schemas.quiz import QuizResponse
from app.schemas.tutor import QuestionOut, QuestionResponse
from app.services import (
    evaluation_service,
    progress_service,
    question_service,
    recommendation_service,
    subject_service,
    topic_service,
    tutor_service,
)
from app.services.ai_service import StructuredLLM

TOPIC_TEST_LENGTH = 10
COURSE_EXAM_QUESTIONS_PER_TOPIC = 2
SECONDS_PER_QUESTION = 90
# Covers network delay when the browser submits automatically at 0:00.
SUBMIT_GRACE_SECONDS = 15
STRONG_RATIO = 0.75
# Finishing in under this share of the time with a low score suggests rushing.
RUSHED_TIME_RATIO = 0.25
# A course exam is rejected if the AI covered less than this share of the requested questions.
MIN_COURSE_EXAM_COVERAGE = 0.5

TOPIC_SCOPE = "topic"
COURSE_SCOPE = "course"


# ---------- Starting ----------


async def start_topic_test(user: User, topic_slug: str, ai: StructuredLLM) -> FinalTest:
    topic = await topic_service.get_topic(topic_slug)
    progress = await progress_service.get_topic_progress(user.id, topic_slug)
    locked_until = progress_service.active_lock(progress.final_test_locked_until if progress else None)
    if locked_until:
        raise ConflictError(
            f"The {topic.name} final test is locked after {progress_service.FAILS_BEFORE_COOLDOWN} failed attempts "
            f"in a row. You can try again after {_format_time(locked_until)}."
        )
    attempts_left = progress_service.final_test_attempts_left(progress)
    if attempts_left == 0:
        raise ConflictError(
            f"You've completed the {topic.name} final test and used all "
            f"{progress_service.MAX_ATTEMPTS_AFTER_PASS} new attempts."
        )
    difficulty = await progress_service.get_current_difficulty(user, topic_slug)
    context = await tutor_service.build_learner_context(user, topic_slug, difficulty, LearningMode.FINAL_TEST)
    recent_prompts = await question_service.get_recent_prompts(user.id, topic_slug)

    generated = await ai.generate_structured(
        system_prompt=build_system_prompt(context),
        user_prompt=build_final_test_prompt(
            TOPIC_TEST_LENGTH, recent_prompts, await tutor_service.notes_for(topic_slug, topic.key_concepts)
        ),
        response_model=QuizResponse,
    )
    items = generated.questions[:TOPIC_TEST_LENGTH]
    for item in items:
        tutor_service.align_concept(item, topic.key_concepts)

    test = await _create_test(
        user,
        scope=TOPIC_SCOPE,
        subject_slug=topic.subject,
        topic_slug=topic_slug,
        difficulty=difficulty,
        questions_by_topic=[(topic_slug, items)],
    )
    # Counted only once the test exists, so a failed generation doesn't use up an attempt.
    if attempts_left is not None:
        await progress_service.use_attempt_after_pass(user.id, topic_slug)
    return test


async def start_course_exam(user: User, subject_slug: str, ai: StructuredLLM) -> FinalTest:
    subject = await subject_service.get_subject(subject_slug)
    course = await progress_service.get_overall_progress(user, subject_slug)
    if course.course_exam_passed:
        raise ConflictError(f"You've already completed the {subject.name} course exam.")
    if course.course_exam_locked_until:
        raise ConflictError(
            f"You can retake the {subject.name} course exam after {_format_time(course.course_exam_locked_until)}."
        )
    if not course.course_exam_unlocked:
        remaining = ", ".join(course.topics_remaining)
        raise ConflictError(f"The {subject.name} course exam unlocks once every topic is complete. Still to complete: {remaining}.")
    topics = await topic_service.list_topics(subject_slug)
    difficulty = progress_service.default_difficulty(user)

    generated = await ai.generate_structured(
        system_prompt=build_course_exam_system_prompt(
            subject.name, user.name, user.level or "beginner", (user.goal or "learn").replace("_", " ")
        ),
        user_prompt=build_course_exam_prompt(
            [(topic.slug, topic.name, topic.key_concepts) for topic in topics], COURSE_EXAM_QUESTIONS_PER_TOPIC
        ),
        response_model=CourseExamResponse,
    )

    # Keep the course order, drop questions for unknown topics, and cap each topic's share.
    by_topic: dict[str, list[QuestionResponse]] = defaultdict(list)
    for item in generated.questions:
        if item.topic_slug in {topic.slug for topic in topics}:
            by_topic[item.topic_slug].append(QuestionResponse(**item.model_dump(exclude={"topic_slug"})))
    questions_by_topic = []
    for topic in topics:
        items = by_topic[topic.slug][:COURSE_EXAM_QUESTIONS_PER_TOPIC]
        for item in items:
            tutor_service.align_concept(item, topic.key_concepts)
        if items:
            questions_by_topic.append((topic.slug, items))

    total = sum(len(items) for _, items in questions_by_topic)
    if total < len(topics) * COURSE_EXAM_QUESTIONS_PER_TOPIC * MIN_COURSE_EXAM_COVERAGE:
        raise AIServiceError("The course exam couldn't be generated properly. Please try again.")

    return await _create_test(
        user,
        scope=COURSE_SCOPE,
        subject_slug=subject_slug,
        topic_slug=None,
        difficulty=difficulty,
        questions_by_topic=questions_by_topic,
    )


async def _create_test(
    user: User,
    *,
    scope: str,
    subject_slug: str,
    topic_slug: str | None,
    difficulty: Level,
    questions_by_topic: list[tuple[str, list[QuestionResponse]]],
) -> FinalTest:
    # The id is created first because each question stores it as its session_id.
    test_id = ObjectId()
    question_ids: list[str] = []
    for question_topic, items in questions_by_topic:
        saved = await question_service.save_questions(
            user_id=user.id,
            session_id=str(test_id),
            topic_slug=question_topic,
            mode=LearningMode.FINAL_TEST,
            difficulty=difficulty,
            generated=items,
        )
        question_ids.extend(question.id for question in saved)

    # The clock starts once the questions are ready, not while they're being generated.
    now = datetime.now(UTC)
    document = {
        "_id": test_id,
        "user_id": user.id,
        "scope": scope,
        "subject_slug": subject_slug,
        "topic_slug": topic_slug,
        "difficulty": difficulty.value,
        "question_ids": question_ids,
        "answers": {},
        "flagged": [],
        "visited": [],
        "time_limit_seconds": len(question_ids) * SECONDS_PER_QUESTION,
        "started_at": now,
        "submitted_at": None,
        "result": None,
        "created_at": now,
    }
    await get_database().final_tests.insert_one(document)
    return FinalTest.from_document(document)


# ---------- Loading ----------


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


async def _get_open_test(user: User, test_id: str, question_id: str) -> FinalTest:
    test = await get_final_test(user.id, test_id)
    if test.submitted_at is not None or datetime.now(UTC) > _closes_at(test):
        raise ConflictError("This test has already finished.")
    if question_id not in test.question_ids:
        raise NotFoundError("Question not found in this test.")
    return test


async def save_answer(user: User, test_id: str, question_id: str, answer: str) -> None:
    test = await _get_open_test(user, test_id, question_id)
    # Safe as a field path: question ids are ObjectId hex strings (checked above).
    await get_database().final_tests.update_one(
        {"_id": to_object_id(test.id)}, {"$set": {f"answers.{question_id}": answer}}
    )


async def update_question_status(user: User, test_id: str, status: QuestionStatusUpdate) -> None:
    test = await _get_open_test(user, test_id, status.question_id)
    add: dict[str, str] = {}
    remove: dict[str, str] = {}
    if status.flagged is not None:
        (add if status.flagged else remove)["flagged"] = status.question_id
    if status.visited is not None:
        (add if status.visited else remove)["visited"] = status.question_id

    update: dict = {}
    if add:
        update["$addToSet"] = add
    if remove:
        update["$pull"] = remove
    if update:
        await get_database().final_tests.update_one({"_id": to_object_id(test.id)}, update)


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
    topic_names = await _topic_names(test)
    reviews = [
        _review(question, answers.get(question.id, ""), topic_names.get(question.topic_slug) if test.scope == COURSE_SCOPE else None)
        for question in questions
    ]

    for question, review in zip(questions, reviews, strict=True):
        await progress_service.record_attempt(user, question, review.your_answer, review.correct, 100 if review.correct else 0)
        await question_service.record_question_attempt(question.id, review.correct)

    time_taken = min(int((now - test.started_at).total_seconds()), test.time_limit_seconds)
    is_course_exam = test.scope == COURSE_SCOPE or not test.topic_slug
    result = analyze_results(
        questions,
        reviews,
        time_taken=time_taken,
        time_limit=test.time_limit_seconds,
        finished_by=finished_by,
        subject_label=await _subject_label(test),
        topic_names=topic_names if test.scope == COURSE_SCOPE else None,
        is_course_exam=is_course_exam,
    )
    if is_course_exam:
        retry = await progress_service.record_course_exam_result(user.id, test.subject_slug, result.accuracy)
    else:
        retry = await progress_service.record_final_test_result(user.id, test.topic_slug or "", result.accuracy)
    if not result.passed:
        result = result.model_copy(
            update={
                "retry_available_at": retry.retry_available_at,
                "fails_in_row": retry.fails_in_row,
                "remarks": [*_retry_remark(retry, is_course_exam), *result.remarks],
            }
        )
    await get_database().final_tests.update_one(
        {"_id": to_object_id(test.id)}, {"$set": {"result": result.model_dump()}}
    )
    return await get_final_test(user.id, test.id)


async def _topic_names(test: FinalTest) -> dict[str, str]:
    topics = await topic_service.list_topics(test.subject_slug)
    return {topic.slug: topic.name for topic in topics}


async def _subject_label(test: FinalTest) -> str:
    """What the result remarks refer to: the topic name, or the course name for a course exam."""
    if test.scope == COURSE_SCOPE or not test.topic_slug:
        return f"the {(await subject_service.get_subject(test.subject_slug)).name} course"
    return (await topic_service.get_topic(test.topic_slug)).name


def _review(question: Question, answer: str, topic_name: str | None) -> QuestionReview:
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
        topic_name=topic_name,
    )


def analyze_results(
    questions: list[Question],
    reviews: list[QuestionReview],
    *,
    time_taken: int,
    time_limit: int,
    finished_by: str,
    subject_label: str,
    topic_names: dict[str, str] | None,
    is_course_exam: bool = False,
) -> FinalTestResult:
    total = len(reviews)
    correct = sum(review.correct for review in reviews)
    accuracy = progress_service.calculate_accuracy(correct, total)

    concept_scores: dict[str, ConceptScore] = {}
    for review in reviews:
        score = concept_scores.setdefault(review.concept, ConceptScore(concept=review.concept, correct=0, total=0))
        score.total += 1
        score.correct += int(review.correct)

    topic_scores: dict[str, TopicScore] = {}
    if topic_names is not None:
        for question, review in zip(questions, reviews, strict=True):
            name = topic_names.get(question.topic_slug, question.topic_slug)
            score = topic_scores.setdefault(
                question.topic_slug, TopicScore(topic_slug=question.topic_slug, topic_name=name, correct=0, total=0)
            )
            score.total += 1
            score.correct += int(review.correct)

    # Course exams judge strengths per topic; topic tests judge them per concept.
    if topic_names is not None:
        rated = [(score.topic_name, score.correct / score.total) for score in topic_scores.values()]
    else:
        rated = [(score.concept, score.correct / score.total) for score in concept_scores.values()]

    return FinalTestResult(
        correct=correct,
        total=total,
        accuracy=accuracy,
        time_taken_seconds=time_taken,
        finished_by=finished_by,
        concept_scores=list(concept_scores.values()),
        topic_scores=list(topic_scores.values()),
        strong_areas=[name for name, ratio in rated if ratio >= STRONG_RATIO],
        needs_practice=[name for name, ratio in rated if ratio < STRONG_RATIO],
        remarks=_pass_remark(accuracy, is_course_exam)
        + _result_remarks(reviews, accuracy, time_taken, time_limit, finished_by, subject_label),
        review=reviews,
        passed=accuracy >= progress_service.FINAL_TEST_PASS_MARK,
        pass_mark=progress_service.FINAL_TEST_PASS_MARK,
    )


def _format_time(moment: datetime) -> str:
    """A UTC time for error messages; the app shows a live countdown in the learner's own timezone."""
    return moment.astimezone(UTC).strftime("%d %b %Y, %H:%M UTC")


def _retry_remark(retry: progress_service.RetryState, is_course_exam: bool) -> list[str]:
    hours = int(progress_service.RETRY_COOLDOWN.total_seconds() // 3600)
    if is_course_exam:
        return [f"You can retake the course exam in {hours} hours. Use the time to review the weaker topics."]
    if retry.retry_available_at:
        return [
            f"Failed {progress_service.FAILS_BEFORE_COOLDOWN} times in a row, so this test is locked for {hours} hours. "
            "Use the time to review the topic in Learn and Practice."
        ]
    if retry.fails_in_row == 0:
        return []  # A new attempt after already passing: failing it changes nothing.
    left = progress_service.FAILS_BEFORE_COOLDOWN - retry.fails_in_row
    return [
        f"{retry.fails_in_row} of {progress_service.FAILS_BEFORE_COOLDOWN} failed attempts in a row. "
        f"{left} more failed attempt{'s' if left != 1 else ''} will lock the test for {hours} hours."
    ]


def _pass_remark(accuracy: float, is_course_exam: bool) -> list[str]:
    mark = progress_service.FINAL_TEST_PASS_MARK
    what = "course" if is_course_exam else "topic"
    if accuracy >= mark:
        return [f"Passed! This counts toward completing the {what}."]
    return [f"Not passed: you need {mark:.0f}% or more to complete the {what}."]


def _result_remarks(
    reviews: list[QuestionReview],
    accuracy: float,
    time_taken: int,
    time_limit: int,
    finished_by: str,
    subject_label: str,
) -> list[str]:
    if accuracy >= 90:
        remarks = [f"Excellent result. You have a strong command of {subject_label}."]
    elif accuracy >= 70:
        remarks = ["Good result. Review the areas under Needs practice to close the remaining gaps."]
    elif accuracy >= 50:
        remarks = ["You're partway there. Revisit the missed areas in Learn mode, then practice them before retaking the test."]
    else:
        remarks = ["This needs more work. Start with a Learn session on the missed areas, then build up with practice questions."]

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
    if test.scope == COURSE_SCOPE or not test.topic_slug:
        title = f"{(await subject_service.get_subject(test.subject_slug)).name} course exam"
    else:
        title = f"{(await topic_service.get_topic(test.topic_slug)).name} final test"

    questions = await question_service.get_questions(user.id, test.question_ids)
    submitted = test.submitted_at is not None
    seconds_remaining = 0
    if not submitted:
        seconds_remaining = max(0, int((_deadline(test) - datetime.now(UTC)).total_seconds()))

    return FinalTestOut(
        id=test.id,
        scope=test.scope,
        title=title,
        subject_slug=test.subject_slug,
        topic_slug=test.topic_slug,
        difficulty=test.difficulty,
        questions=[QuestionOut.from_question(question) for question in questions],
        answers=test.answers,
        flagged=test.flagged,
        visited=test.visited,
        time_limit_seconds=test.time_limit_seconds,
        seconds_remaining=seconds_remaining,
        started_at=test.started_at,
        submitted=submitted,
        result=test.result,
        recommendation=(
            await recommendation_service.recommend_next_topic(user, test.subject_slug) if submitted else None
        ),
    )