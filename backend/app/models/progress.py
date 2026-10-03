from datetime import datetime

from pydantic import BaseModel

from app.models.base import MongoModel
from app.models.enums import Level, Mastery


class ConceptStat(BaseModel):
    concept: str
    attempted: int = 0
    correct: int = 0


class TopicProgress(MongoModel):
    user_id: str
    topic_slug: str
    questions_attempted: int = 0
    correct_answers: int = 0
    accuracy: float = 0.0
    mastery: Mastery = Mastery.NOT_STARTED
    current_difficulty: Level
    # Concept stats are a list (not a dict) because concept names may contain dots,
    # which MongoDB does not allow in field names.
    concept_stats: list[ConceptStat] = []
    # Results since the last difficulty change; restarts at each new level (see adjust_difficulty).
    recent_results: list[bool] = []
    # The last 10 first-attempt results, never reset. Used by the completion standard.
    last_answers: list[bool] = []
    # Best topic final test score (accuracy %) and whether the pass mark has ever been reached.
    best_final_test_accuracy: float | None = None
    final_test_passed: bool = False
    # New attempts started after passing; limited to MAX_ATTEMPTS_AFTER_PASS.
    final_test_attempts_after_pass: int = 0
    # Failed attempts in a row before the test is first passed. Reaching FAILS_BEFORE_COOLDOWN locks
    # the test until final_test_locked_until, after which the count starts again.
    final_test_fails_in_row: int = 0
    final_test_locked_until: datetime | None = None
    last_attempted_at: datetime | None = None


class CourseProgress(MongoModel):
    """Course exam results for one learner and one course."""

    user_id: str
    subject_slug: str
    best_exam_accuracy: float | None = None
    exam_passed: bool = False
    exam_attempts: int = 0
    # After a failed course exam, the next attempt opens at this time.
    exam_locked_until: datetime | None = None