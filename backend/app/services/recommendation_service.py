"""Deterministic "what to study next" logic.

The decision is rule-based so it is predictable and testable; the wording is a fixed template
rather than AI-generated text.

Order of the rules:
1. Review a clearly weak topic before moving on.
2. Go through topics in course order: start it, keep practicing it, or take its final test
   once everything else for that topic is done.
3. When every topic is complete, take the course exam (until it's passed).
4. Strengthen the weakest topic that isn't complete.
5. Everything done: a harder quiz to stay sharp.
"""

from app.core.exceptions import NotFoundError
from app.models.enums import DIFFICULTY_ORDER, LearningMode, Level, Mastery
from app.models.progress import TopicProgress
from app.models.topic import Topic
from app.models.user import User
from app.schemas.progress import RecommendationResponse
from app.services import progress_service, subject_service, topic_service

# Below this many answered questions we don't judge a topic as weak or strong yet.
MIN_ATTEMPTS_TO_JUDGE = 3
FINAL_TEST_MODE = "final_test"
COURSE_EXAM_MODE = "course_exam"


async def recommend_next_topic(user: User, subject_slug: str) -> RecommendationResponse:
    subject = await subject_service.get_subject(subject_slug)
    topics = await topic_service.list_topics(subject_slug)
    if not topics:
        raise NotFoundError("No topics are available yet.")
    progress_by_slug = await progress_service.get_progress_by_topic(user.id)
    course = await progress_service.get_course_progress(user.id, subject_slug)
    return choose_recommendation(
        topics,
        progress_by_slug,
        progress_service.default_difficulty(user),
        subject_slug=subject.slug,
        subject_name=subject.name,
        course_exam_passed=bool(course and course.exam_passed),
    )


def choose_recommendation(
    topics: list[Topic],
    progress_by_slug: dict[str, TopicProgress],
    default_difficulty: Level,
    *,
    subject_slug: str = "python",
    subject_name: str = "Python",
    course_exam_passed: bool = False,
) -> RecommendationResponse:
    def recommend(topic: Topic | None, reason: str, message: str, mode: str, difficulty: Level) -> RecommendationResponse:
        return RecommendationResponse(
            subject_slug=subject_slug,
            topic_slug=topic.slug if topic else "",
            topic_name=topic.name if topic else f"{subject_name} course exam",
            reason=reason,
            message=message,
            suggested_mode=mode,
            suggested_difficulty=difficulty,
        )

    completions = {topic.slug: progress_service.calculate_completion(topic, progress_by_slug.get(topic.slug)) for topic in topics}
    judged = [
        (topic, progress_by_slug[topic.slug])
        for topic in topics
        if topic.slug in progress_by_slug
        and progress_by_slug[topic.slug].questions_attempted >= MIN_ATTEMPTS_TO_JUDGE
    ]

    # 1. Fix a clearly weak topic before moving on.
    weak = [(topic, progress) for topic, progress in judged if progress.mastery == Mastery.NEEDS_PRACTICE]
    if weak:
        topic, progress = min(weak, key=lambda item: item[1].accuracy)
        return recommend(
            topic,
            "needs_review",
            f"Your accuracy in {topic.name} is {progress.accuracy:.0f}%. Reviewing it now will make the next topics easier.",
            LearningMode.LEARN.value,
            progress.current_difficulty,
        )

    # 2. Work through topics in course order.
    for topic in topics:
        progress = progress_by_slug.get(topic.slug)
        if progress is None:
            return recommend(
                topic, "next_topic", f"Start {topic.name} next: {topic.description}", LearningMode.LEARN.value, default_difficulty
            )
        if progress.questions_attempted < MIN_ATTEMPTS_TO_JUDGE:
            return recommend(
                topic,
                "continue_topic",
                f"Keep going with {topic.name}. A few more practice questions will show how well it's sticking.",
                LearningMode.PRACTICE.value,
                progress.current_difficulty,
            )
        if completions[topic.slug].ready_for_final_test:
            return recommend(
                topic,
                "take_final_test",
                f"You've met every practice requirement for {topic.name}. Pass its final test to complete the topic.",
                FINAL_TEST_MODE,
                progress.current_difficulty,
            )

    # 3. Every topic complete: the course exam is unlocked.
    if all(completion.completed for completion in completions.values()) and not course_exam_passed:
        return recommend(
            None,
            "course_exam",
            f"Every {subject_name} topic is complete. Pass the course exam to complete the course.",
            COURSE_EXAM_MODE,
            default_difficulty,
        )

    # 4. Strengthen the weakest topic that isn't complete yet.
    incomplete = [(topic, progress) for topic, progress in judged if not completions[topic.slug].completed]
    if incomplete:
        topic, progress = min(incomplete, key=lambda item: item[1].accuracy)
        return recommend(
            topic,
            "strengthen",
            f"{topic.name} is your least complete topic at {progress.accuracy:.0f}% accuracy. "
            "More practice will get it over the line.",
            LearningMode.PRACTICE.value,
            progress.current_difficulty,
        )

    # 5. Everything done: challenge the learner at a higher difficulty.
    topic, progress = min(judged, key=lambda item: item[1].accuracy) if judged else (topics[0], None)
    current = progress.current_difficulty if progress else default_difficulty
    harder = DIFFICULTY_ORDER[min(DIFFICULTY_ORDER.index(current) + 1, len(DIFFICULTY_ORDER) - 1)]
    return recommend(
        topic,
        "challenge",
        f"You've completed the {subject_name} course. Try a {harder.value} quiz on {topic.name} to stay sharp.",
        LearningMode.QUIZ.value,
        harder,
    )