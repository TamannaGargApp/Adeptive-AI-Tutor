"""Coding exercises, the admin dashboard, and personalized feedback."""

import pytest
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.feedback import FeedbackArea, FeedbackResponse
from app.schemas.tutor import QuestionResponse

CODE_EXERCISE = QuestionResponse(
    question_type="write_code",
    prompt="Write a function add(a, b) that returns the sum of a and b.",
    code=None,
    options=[],
    correct_answer="def add(a, b):\n    return a + b",
    explanation="Return the sum with the + operator.",
    concept="defining functions",
    hint="Use the return keyword.",
    starter_code="def add(a, b):\n    pass",
    test_cases=[{"input": "add(2, 3)", "expected_output": "5"}, {"input": "add(-1, 1)", "expected_output": "0"}],
)


def test_coding_exercises_need_test_cases():
    with pytest.raises(ValidationError):
        QuestionResponse(**{**CODE_EXERCISE.model_dump(), "test_cases": []})


async def _code_question(client, fake_ai) -> dict:
    fake_ai.responses[QuestionResponse] = CODE_EXERCISE
    session = (await client.post("/api/sessions", json={"topic_slug": "functions", "mode": "practice"})).json()
    return (await client.post("/api/tutor/practice", json={"session_id": session["id"]})).json()


async def test_coding_exercise_shows_tests_but_not_the_solution(auth_client, fake_ai):
    question = await _code_question(auth_client, fake_ai)
    assert question["question_type"] == "write_code"
    assert question["starter_code"].startswith("def add")
    assert [test["input"] for test in question["test_cases"]] == ["add(2, 3)", "add(-1, 1)"]
    assert question["language"] == "python"
    assert "correct_answer" not in question


async def test_coding_exercise_is_graded_by_its_test_results(auth_client, fake_ai):
    question = await _code_question(auth_client, fake_ai)
    code = "def add(a, b):\n    return a + b"

    missing = await auth_client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": code})
    assert missing.status_code == 400

    failing = await auth_client.post(
        "/api/tutor/evaluate",
        json={
            "question_id": question["id"],
            "answer": code,
            "test_results": [{"passed": True, "output": "5"}, {"passed": False, "output": "2"}],
        },
    )
    assert failing.json()["correct"] is False

    passing = await auth_client.post(
        "/api/tutor/evaluate",
        json={
            "question_id": question["id"],
            "answer": code,
            "test_results": [{"passed": True, "output": "5"}, {"passed": True, "output": "0"}],
        },
    )
    assert passing.json()["correct"] is True
    assert passing.json()["correct_answer"].startswith("def add")


async def test_admin_area_is_for_admins_only(auth_client):
    assert (await auth_client.get("/api/admin/stats")).status_code == 403
    me = (await auth_client.get("/api/auth/me")).json()
    assert me["is_admin"] is False


async def test_admin_can_manage_content(auth_client, monkeypatch):
    monkeypatch.setattr(get_settings(), "admin_emails", "ada@example.com")
    assert (await auth_client.get("/api/auth/me")).json()["is_admin"] is True

    stats = (await auth_client.get("/api/admin/stats")).json()
    assert stats["users"] == 1
    assert {course["slug"] for course in stats["courses"]} == {"python", "javascript"}
    assert (await auth_client.get("/api/admin/users")).json()[0]["email"] == "ada@example.com"

    created = await auth_client.post(
        "/api/admin/topics",
        json={
            "subject_slug": "python",
            "name": "Classes",
            "description": "Bundle data and behaviour into objects.",
            "key_concepts": ["class definitions", "methods", " methods "],
        },
    )
    assert created.status_code == 201
    topic = created.json()
    assert topic["slug"] == "python-classes"
    assert topic["key_concepts"] == ["class definitions", "methods"]
    assert topic["order"] == 10

    learner_topics = (await auth_client.get("/api/topics")).json()
    assert learner_topics[-1]["slug"] == "python-classes"

    moved = (await auth_client.post("/api/admin/topics/python-classes/move", json={"direction": "up"})).json()
    assert [item["slug"] for item in moved][-2:] == ["python-classes", "file-handling"]

    archived = await auth_client.put(
        "/api/admin/topics/python-classes",
        json={**{k: topic[k] for k in ("name", "description", "key_concepts")}, "archived": True},
    )
    assert archived.json()["archived"] is True
    assert "python-classes" not in [item["slug"] for item in (await auth_client.get("/api/topics")).json()]


FEEDBACK = FeedbackResponse(
    summary="You're making steady progress.",
    strengths=["Loop syntax"],
    areas_to_improve=[FeedbackArea(area="range()", why="Off-by-one answers.", how="Practice range() in Loops.")],
    mistake_patterns=["Starting counts at 1"],
    next_steps=["Review range()", "Do 5 practice questions", "Take the Loops final test"],
    encouragement="Keep going!",
)


async def test_feedback_needs_some_answers_then_reuses_the_report(auth_client, fake_ai):
    assert (await auth_client.get("/api/feedback")).json() is None
    assert (await auth_client.post("/api/feedback")).status_code == 400

    fake_ai.responses[QuestionResponse] = CODE_EXERCISE.model_copy(
        update={"question_type": "short_answer", "test_cases": [], "starter_code": None}
    )
    fake_ai.responses[FeedbackResponse] = FEEDBACK
    from app.schemas.tutor import EvaluationResponse

    fake_ai.responses[EvaluationResponse] = EvaluationResponse(
        correct=False, score=0, feedback="Not quite.", hint=None, correct_answer=None, concept="defining functions", difficulty="beginner"
    )
    session = (await auth_client.post("/api/sessions", json={"topic_slug": "functions", "mode": "practice"})).json()
    for _ in range(5):
        question = (await auth_client.post("/api/tutor/practice", json={"session_id": session["id"]})).json()
        await auth_client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": "no idea"})

    report = (await auth_client.post("/api/feedback")).json()
    assert report["report"]["summary"] == FEEDBACK.summary
    assert report["based_on_answers"] == 5
    assert report["can_refresh"] is False

    calls_before = fake_ai.calls.count("FeedbackResponse")
    again = (await auth_client.post("/api/feedback")).json()
    assert again["report"]["summary"] == FEEDBACK.summary
    assert fake_ai.calls.count("FeedbackResponse") == calls_before  # No new answers: no new AI call.


async def test_admin_can_delete_a_course_after_previewing(auth_client, monkeypatch, database):
    monkeypatch.setattr(get_settings(), "admin_emails", "ada@example.com")
    await auth_client.post("/api/plan/subjects/javascript")

    default = (await auth_client.get("/api/admin/courses/python/delete-preview")).json()
    assert default["can_delete"] is False
    assert (await auth_client.delete("/api/admin/courses/python")).status_code == 400

    preview = (await auth_client.get("/api/admin/courses/javascript/delete-preview")).json()
    assert (preview["can_delete"], preview["topics"], preview["learners"]) == (True, 9, 1)

    assert (await auth_client.delete("/api/admin/courses/javascript")).status_code == 204
    me = (await auth_client.get("/api/auth/me")).json()
    assert me["subjects"] == ["python"]
    assert me["current_subject"] == "python"
    assert "javascript" not in [course["slug"] for course in (await auth_client.get("/api/subjects")).json()]
    assert await database.topics.count_documents({"subject": "javascript"}) == 0

    # Restarting the app must not bring a deleted built-in course back.
    from app.db.seed import seed_courses

    await seed_courses()
    assert await database.topics.count_documents({"subject": "javascript"}) == 0


async def test_reading_material_is_generated_once_then_shared(auth_client, fake_ai, monkeypatch):
    from app.schemas.material import StudyMaterialResponse

    fake_ai.responses[StudyMaterialResponse] = StudyMaterialResponse(
        content="Loops repeat code.\n\n## for loop\n\n```python\nfor i in range(2):\n    print(i)\n```",
        key_takeaways=["range(n) starts at 0."],
    )
    first = (await auth_client.get("/api/topics/loops/material")).json()
    second = (await auth_client.get("/api/topics/loops/material")).json()
    assert first["content"].startswith("Loops repeat code.")
    assert second["content"] == first["content"]
    assert fake_ai.calls.count("StudyMaterialResponse") == 1

    monkeypatch.setattr(get_settings(), "admin_emails", "ada@example.com")
    edited = (
        await auth_client.put(
            "/api/admin/topics/loops/material",
            json={"content": "Edited notes about loops and range().", "key_takeaways": ["Practice daily."]},
        )
    ).json()
    assert edited["edited"] is True
    assert (await auth_client.get("/api/topics/loops/material")).json()["content"].startswith("Edited notes")


def test_escaped_line_breaks_in_study_notes_are_repaired():
    from app.services.material_service import fix_escaped_newlines

    assert fix_escaped_newlines("Intro.\\n\\n## print()\\nText.") == "Intro.\n\n## print()\nText."
    untouched = 'Real lines\nprint("a\\nb")\nmore'
    assert fix_escaped_newlines(untouched) == untouched