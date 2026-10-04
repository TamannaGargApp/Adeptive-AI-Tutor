from enum import StrEnum


class Level(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class LearningGoal(StrEnum):
    LEARN_PYTHON = "learn_python"
    IMPROVE_PROBLEM_SOLVING = "improve_problem_solving"
    INTERVIEW_PREPARATION = "interview_preparation"


class LearningMode(StrEnum):
    LEARN = "learn"
    PRACTICE = "practice"
    QUIZ = "quiz"
    FINAL_TEST = "final_test"


class QuestionType(StrEnum):
    MULTIPLE_CHOICE = "multiple_choice"
    PREDICT_OUTPUT = "predict_output"
    SHORT_ANSWER = "short_answer"
    # The learner writes code; it runs in their browser against the question's test cases.
    WRITE_CODE = "write_code"


class Mastery(StrEnum):
    NOT_STARTED = "not_started"
    NEEDS_PRACTICE = "needs_practice"
    DEVELOPING = "developing"
    STRONG = "strong"
    MASTERED = "mastered"


class CompletionStatus(StrEnum):
    NOT_STARTED = "not_started"
    NEEDS_PRACTICE = "needs_practice"
    IN_PROGRESS = "in_progress"
    ALMOST_COMPLETE = "almost_complete"
    COMPLETE = "complete"


DIFFICULTY_ORDER: list[Level] = [Level.BEGINNER, Level.INTERMEDIATE, Level.ADVANCED]