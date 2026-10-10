from enum import StrEnum


class Level(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class LearningGoal(StrEnum):
    LEARN_PYTHON = "learn_python"
    IMPROVE_PROBLEM_SOLVING = "improve_problem_solving"
    INTERVIEW_PREPARATION = "interview_preparation"


# How each goal reads in AI prompts. The stored values stay the same for existing accounts
# ("learn_python" predates multi-course support and now means learning any new language).
GOAL_DESCRIPTIONS: dict[str, str] = {
    LearningGoal.LEARN_PYTHON: "learn a new programming language or framework",
    LearningGoal.IMPROVE_PROBLEM_SOLVING: "improve problem solving",
    LearningGoal.INTERVIEW_PREPARATION: "interview preparation",
}


def describe_goal(goal: str | None) -> str:
    if not goal:
        return "learn"
    return GOAL_DESCRIPTIONS.get(goal, goal.replace("_", " "))


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