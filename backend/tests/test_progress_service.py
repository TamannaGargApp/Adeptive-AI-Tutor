import pytest

from app.models.enums import LearningMode, Level, Mastery, QuestionType
from app.models.progress import ConceptStat
from app.services.evaluation_service import grade_deterministically, normalize_output
from app.services.progress_service import (
    adjust_difficulty,
    calculate_accuracy,
    find_strengths_and_weaknesses,
    mastery_for,
    update_concept_stats,
)


def test_accuracy_is_a_rounded_percentage():
    assert calculate_accuracy(2, 3) == 66.7
    assert calculate_accuracy(0, 0) == 0.0


@pytest.mark.parametrize(
    ("accuracy", "expected"),
    [
        (100, Mastery.MASTERED),
        (90, Mastery.MASTERED),
        (89.9, Mastery.STRONG),
        (75, Mastery.STRONG),
        (74, Mastery.DEVELOPING),
        (50, Mastery.DEVELOPING),
        (49, Mastery.NEEDS_PRACTICE),
        (0, Mastery.NEEDS_PRACTICE),
    ],
)
def test_mastery_thresholds(accuracy, expected):
    assert mastery_for(accuracy, attempted=10) == expected


def test_no_attempts_means_not_started():
    assert mastery_for(0, attempted=0) == Mastery.NOT_STARTED


def test_difficulty_increases_after_three_correct():
    assert adjust_difficulty(Level.BEGINNER, [False, True, True, True]) == Level.INTERMEDIATE


def test_difficulty_decreases_after_repeated_mistakes():
    assert adjust_difficulty(Level.INTERMEDIATE, [True, False, False]) == Level.BEGINNER


def test_difficulty_is_stable_with_too_little_data_or_mixed_results():
    assert adjust_difficulty(Level.BEGINNER, [True, True]) == Level.BEGINNER
    assert adjust_difficulty(Level.INTERMEDIATE, [True, False, True]) == Level.INTERMEDIATE


def test_difficulty_stays_within_bounds():
    assert adjust_difficulty(Level.ADVANCED, [True, True, True]) == Level.ADVANCED
    assert adjust_difficulty(Level.BEGINNER, [False, False, False]) == Level.BEGINNER


def test_strengths_and_weaknesses_from_concept_stats():
    stats = [
        ConceptStat(concept="range()", attempted=4, correct=4),
        ConceptStat(concept="while loop", attempted=4, correct=1),
        ConceptStat(concept="break", attempted=2, correct=1),
    ]
    strengths, weaknesses = find_strengths_and_weaknesses(stats)
    assert strengths == ["range()"]
    assert weaknesses == ["while loop"]


def test_concept_stats_merge_case_insensitively():
    stats = update_concept_stats([], "range()", correct=True)
    stats = update_concept_stats(stats, "Range()", correct=False)
    assert len(stats) == 1
    assert (stats[0].attempted, stats[0].correct) == (2, 1)


def test_output_normalization_ignores_spacing():
    assert normalize_output("0\n1\n2\n") == normalize_output("0 1 2")


def _question(question_type: QuestionType, correct_answer: str, options: list[str] | None = None):
    from datetime import UTC, datetime

    from app.models.question import Question

    return Question(
        id="q1",
        user_id="u1",
        session_id="s1",
        topic_slug="loops",
        mode=LearningMode.PRACTICE,
        difficulty=Level.BEGINNER,
        question_type=question_type,
        prompt="?",
        options=options or [],
        correct_answer=correct_answer,
        explanation="",
        concept="range()",
        hint="",
        created_at=datetime.now(UTC),
    )


def test_predict_output_grading_is_exact_but_whitespace_tolerant():
    question = _question(QuestionType.PREDICT_OUTPUT, "0\n1\n2")
    assert grade_deterministically(question, "0 1 2") is True
    assert grade_deterministically(question, "1 2 3") is False


def test_multiple_choice_grading_is_case_insensitive():
    question = _question(QuestionType.MULTIPLE_CHOICE, "range(3)", ["range(3)", "range(4)"])
    assert grade_deterministically(question, "RANGE(3)") is True


def test_short_answers_are_left_to_the_ai():
    assert grade_deterministically(_question(QuestionType.SHORT_ANSWER, "anything"), "x") is None


# ---------- Completion standard ----------

from app.models.enums import CompletionStatus  # noqa: E402
from app.models.progress import TopicProgress  # noqa: E402
from app.models.topic import Topic  # noqa: E402
from app.services.progress_service import calculate_completion, match_key_concept  # noqa: E402

LOOPS = Topic(
    id="t1",
    slug="loops",
    name="Loops",
    description="",
    key_concepts=["for loop", "range()", "while loop", "break and continue", "nested loops"],
    order=4,
)


def _loops_progress(answers: list[bool], covered: list[str], test_passed: bool = False) -> TopicProgress:
    return TopicProgress(
        id="p1",
        user_id="u1",
        topic_slug="loops",
        questions_attempted=len(answers),
        correct_answers=sum(answers),
        current_difficulty=Level.BEGINNER,
        concept_stats=[ConceptStat(concept=concept, attempted=1, correct=1) for concept in covered],
        last_answers=answers[-10:],
        final_test_passed=test_passed,
        best_final_test_accuracy=80.0 if test_passed else None,
    )


def test_untouched_topic_is_zero_percent():
    completion = calculate_completion(LOOPS, None)
    assert completion.percent == 0
    assert completion.status == CompletionStatus.NOT_STARTED
    assert completion.remarks


def test_all_requirements_met_is_100_percent():
    progress = _loops_progress([False] + [True] * 9, LOOPS.key_concepts, test_passed=True)
    completion = calculate_completion(LOOPS, progress)
    assert completion.percent == 100
    assert completion.completed is True
    assert completion.status == CompletionStatus.COMPLETE


def test_missing_concept_blocks_completion():
    progress = _loops_progress([True] * 10, ["for loop", "range()", "while loop", "break and continue"])
    completion = calculate_completion(LOOPS, progress)
    assert completion.completed is False
    assert completion.percent == 74  # 20 questions + 30 accuracy + 24 concepts (4 of 5), no final test
    assert completion.concepts_remaining == ["nested loops"]
    assert any("nested loops" in remark for remark in completion.remarks)


def test_one_lucky_answer_is_not_close_to_complete():
    completion = calculate_completion(LOOPS, _loops_progress([True], ["range()"]))
    assert completion.percent < 20
    assert any("9 more questions" in remark for remark in completion.remarks)


def test_low_recent_accuracy_needs_more_practice():
    completion = calculate_completion(LOOPS, _loops_progress([True, False, False, False], ["for loop"]))
    assert completion.status == CompletionStatus.NEEDS_PRACTICE
    assert completion.remarks[0].startswith("Needs more practice")


def test_recent_answers_matter_more_than_early_mistakes():
    early_mistakes_then_improvement = [False] * 5 + [True] * 10
    completion = calculate_completion(
        LOOPS, _loops_progress(early_mistakes_then_improvement, LOOPS.key_concepts, test_passed=True)
    )
    assert completion.completed is True


def test_ai_concept_names_are_matched_to_key_concepts():
    assert match_key_concept("Range()", LOOPS.key_concepts) == "range()"
    assert match_key_concept("  WHILE   loop ", LOOPS.key_concepts) == "while loop"
    assert match_key_concept("string slicing", LOOPS.key_concepts) is None


def test_requirements_checklist_reports_each_part():
    completion = calculate_completion(LOOPS, _loops_progress([True] * 4, ["for loop", "range()"]))
    assert [requirement.met for requirement in completion.requirements] == [False, False, False, False]
    assert [requirement.progress for requirement in completion.requirements] == ["4/10", "4/9", "2/5", "Not taken"]


def test_practice_alone_never_completes_a_topic():
    completion = calculate_completion(LOOPS, _loops_progress([True] * 10, LOOPS.key_concepts))
    assert completion.completed is False
    assert completion.percent == 80
    assert completion.ready_for_final_test is True
    assert completion.remarks[0].startswith("Ready for the final test")