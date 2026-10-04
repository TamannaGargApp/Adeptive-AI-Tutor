"""Learn mode lessons and question generation for practice and quizzes."""

from datetime import UTC, datetime

from app.models.enums import LearningMode, Level
from app.models.question import Question
from app.models.session import ChatMessage, LearningSession
from app.models.user import User
from app.prompts.tutor_prompt import (
    LearnerContext,
    build_lesson_prompt,
    build_practice_question_prompt,
    build_quiz_prompt,
    build_system_prompt,
)
from app.schemas.quiz import QuizResponse
from app.schemas.tutor import LearnReply, LessonResponse, QuestionResponse
from app.services import progress_service, question_service, session_service, subject_service, topic_service
from app.services.ai_service import StructuredLLM

QUIZ_LENGTH = 5
# Only the latest messages are sent to the AI to keep prompts small and responses fast.
LESSON_HISTORY_LIMIT = 12


async def build_learner_context(
    user: User, topic_slug: str, difficulty: Level, mode: LearningMode
) -> LearnerContext:
    topic = await topic_service.get_topic(topic_slug)
    subject = await subject_service.get_subject(topic.subject)
    progress = await progress_service.get_topic_progress(user.id, topic_slug)
    summary = progress_service.to_topic_progress_out(topic, progress, difficulty)
    return LearnerContext(
        student_name=user.name,
        level=(user.level or "beginner"),
        goal=(user.goal or "learn_python").replace("_", " "),
        topic_name=topic.name,
        topic_description=topic.description,
        key_concepts=topic.key_concepts,
        difficulty=difficulty.value,
        mode=mode.value.replace("_", " "),
        questions_attempted=summary.questions_attempted,
        accuracy=summary.accuracy,
        mastery=summary.mastery.value.replace("_", " "),
        strengths=summary.strengths,
        weaknesses=summary.weaknesses,
        recent_results=progress.recent_results if progress else [],
        subject_name=subject.name,
        language=subject.language,
    )


async def teach(user: User, session_id: str, message: str, ai: StructuredLLM) -> LearnReply:
    session = await session_service.get_session_in_mode(user.id, session_id, LearningMode.LEARN)
    context = await build_learner_context(user, session.topic_slug, session.difficulty, session.mode)
    message = message.strip()

    lesson = await ai.generate_structured(
        system_prompt=build_system_prompt(context),
        user_prompt=build_lesson_prompt(
            session.messages[-LESSON_HISTORY_LIMIT:], message, context.subject_name, context.language
        ),
        response_model=LessonResponse,
    )

    now = datetime.now(UTC)
    reply = ChatMessage(role="tutor", content=lesson.message.strip(), created_at=now)
    new_messages = [ChatMessage(role="student", content=message, created_at=now)] if message else []
    await session_service.append_messages(session.id, [*new_messages, reply])
    return LearnReply(session_id=session.id, reply=reply, lesson=lesson)


def align_concept(generated: QuestionResponse, key_concepts: list[str]) -> None:
    """Use the topic's exact key concept name, so answers count toward concept coverage."""
    matched = progress_service.match_key_concept(generated.concept, key_concepts)
    if matched:
        generated.concept = matched


async def generate_practice_question(user: User, session_id: str, ai: StructuredLLM) -> Question:
    session = await session_service.get_session_in_mode(user.id, session_id, LearningMode.PRACTICE)
    context = await build_learner_context(user, session.topic_slug, session.difficulty, session.mode)
    recent_prompts = await question_service.get_recent_prompts(user.id, session.topic_slug)

    progress = await progress_service.get_topic_progress(user.id, session.topic_slug)
    covered = progress_service.covered_key_concepts(context.key_concepts, progress.concept_stats if progress else [])
    uncovered = [concept for concept in context.key_concepts if concept not in covered]

    generated = await ai.generate_structured(
        system_prompt=build_system_prompt(context),
        user_prompt=build_practice_question_prompt(recent_prompts, uncovered),
        response_model=QuestionResponse,
    )
    align_concept(generated, context.key_concepts)
    [question] = await question_service.save_questions(
        user_id=user.id,
        session_id=session.id,
        topic_slug=session.topic_slug,
        mode=session.mode,
        difficulty=session.difficulty,
        generated=[generated],
        language=context.language,
    )
    return question


async def generate_quiz(user: User, session_id: str, ai: StructuredLLM) -> tuple[LearningSession, list[Question]]:
    session = await session_service.get_session_in_mode(user.id, session_id, LearningMode.QUIZ)

    # Return the existing quiz if the page is refreshed instead of generating a new one.
    if session.quiz_question_ids:
        return session, await question_service.get_questions(user.id, session.quiz_question_ids)

    context = await build_learner_context(user, session.topic_slug, session.difficulty, session.mode)
    recent_prompts = await question_service.get_recent_prompts(user.id, session.topic_slug)
    quiz = await ai.generate_structured(
        system_prompt=build_system_prompt(context),
        user_prompt=build_quiz_prompt(QUIZ_LENGTH, recent_prompts),
        response_model=QuizResponse,
    )
    for generated in quiz.questions:
        align_concept(generated, context.key_concepts)
    questions = await question_service.save_questions(
        user_id=user.id,
        session_id=session.id,
        topic_slug=session.topic_slug,
        mode=session.mode,
        difficulty=session.difficulty,
        generated=quiz.questions[:QUIZ_LENGTH],
        language=context.language,
    )
    await session_service.set_quiz_questions(session.id, [question.id for question in questions])
    return session, questions