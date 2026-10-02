"""Deterministic "what to study next" logic.

The decision is rule-based so it is predictable and testable; the wording is a fixed template
rather than AI-generated text.
"""

from app.core.exceptions import NotFoundError
from app.models.enums import DIFFICULTY_ORDER, LearningMode, Level, Mastery
from app.models.progress import TopicProgress
from app.models.topic import Topic
from app.models.user import User
from app.schemas.progress import RecommendationResponse
from app.services import progress_service, topic_service

# Below this many answered questions we don't judge a topic as weak or strong yet.
MIN_ATTEMPTS_TO_JUDGE = 3


async def recommend_next_topic(user: User) -> RecommendationResponse:
    topics = await topic_service.list_topics()
    if not topics:
        raise NotFoundError("No topics are available yet.")
    progress_by_slug = await progress_service.get_progress_by_topic(user.id)
    return choose_recommendation(topics, progress_by_slug, progress_service.default_difficulty(user))


def choose_recommendation(
    topics: list[Topic], progress_by_slug: dict[str, TopicProgress], default_difficulty: Level
) -> RecommendationResponse:
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
        return RecommendationResponse(
            topic_slug=topic.slug,
            topic_name=topic.name,
            reason="needs_review",
            message=f"Your accuracy in {topic.name} is {progress.accuracy:.0f}%. "
            "Reviewing it now will make the next topics easier.",
            suggested_mode=LearningMode.LEARN,
            suggested_difficulty=progress.current_difficulty,
        )

    # 2. Continue with the next topic in the course order that hasn't been explored enough.
    for topic in topics:
        progress = progress_by_slug.get(topic.slug)
        if progress is None:
            return RecommendationResponse(
                topic_slug=topic.slug,
                topic_name=topic.name,
                reason="next_topic",
                message=f"Start {topic.name} next: {topic.description}",
                suggested_mode=LearningMode.LEARN,
                suggested_difficulty=default_difficulty,
            )
        if progress.questions_attempted < MIN_ATTEMPTS_TO_JUDGE:
            return RecommendationResponse(
                topic_slug=topic.slug,
                topic_name=topic.name,
                reason="continue_topic",
                message=f"Keep going with {topic.name}. A few more practice questions will show how well it's sticking.",
                suggested_mode=LearningMode.PRACTICE,
                suggested_difficulty=progress.current_difficulty,
            )

    # 3. Everything explored: strengthen the weakest topic that isn't mastered.
    not_mastered = [(topic, progress) for topic, progress in judged if progress.mastery != Mastery.MASTERED]
    if not_mastered:
        topic, progress = min(not_mastered, key=lambda item: item[1].accuracy)
        return RecommendationResponse(
            topic_slug=topic.slug,
            topic_name=topic.name,
            reason="strengthen",
            message=f"{topic.name} is your least confident topic at {progress.accuracy:.0f}% accuracy. "
            "More practice will push it to mastery.",
            suggested_mode=LearningMode.PRACTICE,
            suggested_difficulty=progress.current_difficulty,
        )

    # 4. All mastered: challenge the learner at a higher difficulty.
    topic, progress = min(judged, key=lambda item: item[1].accuracy)
    index = DIFFICULTY_ORDER.index(progress.current_difficulty)
    harder = DIFFICULTY_ORDER[min(index + 1, len(DIFFICULTY_ORDER) - 1)]
    return RecommendationResponse(
        topic_slug=topic.slug,
        topic_name=topic.name,
        reason="challenge",
        message=f"You've mastered every topic. Try a {harder.value} quiz on {topic.name} to test yourself.",
        suggested_mode=LearningMode.QUIZ,
        suggested_difficulty=harder,
    )
