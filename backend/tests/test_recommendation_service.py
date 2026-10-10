from app.models.enums import LearningMode, Level
from app.models.progress import TopicProgress
from app.models.topic import Topic
from app.services.progress_service import calculate_accuracy, mastery_for
from app.services.recommendation_service import choose_recommendation

# Any course works the same way; the recommendations never assume a particular one.
COURSE = {"subject_slug": "flask", "subject_name": "Web Development with Flask"}

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
    result = choose_recommendation(TOPICS, {}, Level.BEGINNER, **COURSE)
    assert result.topic_slug == "variables"
    assert result.suggested_mode == LearningMode.LEARN


def test_weak_topic_is_reviewed_before_moving_on():
    progress = {"variables": _progress("variables", 5, 5), "operators": _progress("operators", 5, 1)}
    result = choose_recommendation(TOPICS, progress, Level.BEGINNER, **COURSE)
    assert result.topic_slug == "operators"
    assert result.reason == "needs_review"


def test_good_progress_moves_to_next_unstarted_topic():
    progress = {"variables": _progress("variables", 5, 4), "operators": _progress("operators", 4, 4)}
    result = choose_recommendation(TOPICS, progress, Level.BEGINNER, **COURSE)
    assert result.topic_slug == "loops"
    assert result.reason == "next_topic"


def _complete(slug: str) -> TopicProgress:
    """A topic meeting every completion requirement (the test topics have no key concepts)."""
    return _progress(slug, 10, 10).model_copy(
        update={"last_answers": [True] * 10, "final_test_passed": True, "best_final_test_accuracy": 90.0}
    )


def test_ready_topic_is_sent_to_its_final_test():
    ready = _progress("variables", 10, 10).model_copy(update={"last_answers": [True] * 10})
    result = choose_recommendation(TOPICS, {"variables": ready}, Level.BEGINNER, **COURSE)
    assert result.topic_slug == "variables"
    assert result.suggested_mode == "final_test"


def test_all_topics_complete_unlocks_the_course_exam():
    progress = {topic.slug: _complete(topic.slug) for topic in TOPICS}
    result = choose_recommendation(TOPICS, progress, Level.BEGINNER, subject_slug="python", subject_name="Python")
    assert result.reason == "course_exam"
    assert result.suggested_mode == "course_exam"
    assert result.topic_name == "Python course exam"


def test_completed_course_suggests_a_harder_quiz():
    progress = {topic.slug: _complete(topic.slug) for topic in TOPICS}
    result = choose_recommendation(TOPICS, progress, Level.BEGINNER, **COURSE, course_exam_passed=True)
    assert result.reason == "challenge"
    assert result.suggested_difficulty == Level.INTERMEDIATE