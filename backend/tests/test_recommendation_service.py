from app.models.enums import LearningMode, Level
from app.models.progress import TopicProgress
from app.models.topic import Topic
from app.services.progress_service import calculate_accuracy, mastery_for
from app.services.recommendation_service import choose_recommendation

TOPICS = [
    Topic(id=str(i), slug=slug, name=slug.title(), description="", key_concepts=[], order=i)
    for i, slug in enumerate(["variables", "operators", "loops"], start=1)
]


def _progress(slug: str, attempted: int, correct: int) -> TopicProgress:
    accuracy = calculate_accuracy(correct, attempted)
    return TopicProgress(
        id=slug,
        user_id="u1",
        topic_slug=slug,
        questions_attempted=attempted,
        correct_answers=correct,
        accuracy=accuracy,
        mastery=mastery_for(accuracy, attempted),
        current_difficulty=Level.BEGINNER,
    )


def test_new_learner_starts_with_first_topic():
    result = choose_recommendation(TOPICS, {}, Level.BEGINNER)
    assert result.topic_slug == "variables"
    assert result.suggested_mode == LearningMode.LEARN


def test_weak_topic_is_reviewed_before_moving_on():
    progress = {"variables": _progress("variables", 5, 5), "operators": _progress("operators", 5, 1)}
    result = choose_recommendation(TOPICS, progress, Level.BEGINNER)
    assert result.topic_slug == "operators"
    assert result.reason == "needs_review"


def test_good_progress_moves_to_next_unstarted_topic():
    progress = {"variables": _progress("variables", 5, 4), "operators": _progress("operators", 4, 4)}
    result = choose_recommendation(TOPICS, progress, Level.BEGINNER)
    assert result.topic_slug == "loops"
    assert result.reason == "next_topic"


def test_everything_mastered_suggests_a_harder_quiz():
    progress = {topic.slug: _progress(topic.slug, 10, 10) for topic in TOPICS}
    result = choose_recommendation(TOPICS, progress, Level.BEGINNER)
    assert result.reason == "challenge"
    assert result.suggested_difficulty == Level.INTERMEDIATE
