from datetime import UTC, datetime, timedelta

from bson import ObjectId

from app.schemas.quiz import QuizResponse
from app.schemas.tutor import QuestionResponse


def _question(number: int) -> QuestionResponse:
    return QuestionResponse(
        question_type="multiple_choice",
        prompt=f"Question {number}",
        code=None,
        options=["right", "wrong"],
        correct_answer="right",
        explanation=f"Explanation {number}",
        concept="for loop" if number < 2 else "range()",
        hint="Think.",
    )


async def _start(client, fake_ai, count: int = 3) -> dict:
    fake_ai.responses[QuizResponse] = QuizResponse(questions=[_question(n) for n in range(count)])
    response = await client.post("/api/final-tests", json={"topic_slug": "loops"})
    assert response.status_code == 201
    return response.json()


async def test_answers_stay_hidden_until_submit_then_get_analysed(auth_client, fake_ai):
    test = await _start(auth_client, fake_ai)
    assert test["submitted"] is False
    assert test["result"] is None
    assert test["time_limit_seconds"] == 3 * 90
    assert all("correct_answer" not in question for question in test["questions"])

    first, second, third = (question["id"] for question in test["questions"])
    saved = await auth_client.put(f"/api/final-tests/{test['id']}/answers", json={"question_id": first, "answer": "right"})
    assert saved.status_code == 200

    finished = (
        await auth_client.post(f"/api/final-tests/{test['id']}/submit", json={"answers": {second: "wrong"}})
    ).json()

    result = finished["result"]
    assert finished["submitted"] is True
    assert (result["correct"], result["total"]) == (1, 3)
    assert result["finished_by"] == "submitted"
    assert [review["correct"] for review in result["review"]] == [True, False, False]
    assert result["review"][0]["correct_answer"] == "right"
    assert any("1 question was left unanswered" in remark for remark in result["remarks"])
    assert finished["recommendation"] is not None

    progress = (await auth_client.get("/api/progress/loops")).json()
    assert progress["questions_attempted"] == 3


async def test_final_test_questions_cannot_be_checked_one_by_one(auth_client, fake_ai):
    test = await _start(auth_client, fake_ai)
    response = await auth_client.post(
        "/api/tutor/evaluate", json={"question_id": test["questions"][0]["id"], "answer": "right"}
    )
    assert response.status_code == 400


async def test_submitting_twice_records_progress_once(auth_client, fake_ai):
    test = await _start(auth_client, fake_ai)
    for _ in range(2):
        await auth_client.post(f"/api/final-tests/{test['id']}/submit", json={"answers": {}})
    progress = (await auth_client.get("/api/progress/loops")).json()
    assert progress["questions_attempted"] == 3


async def test_expired_test_is_graded_automatically(auth_client, fake_ai, database):
    test = await _start(auth_client, fake_ai)
    first = test["questions"][0]["id"]
    await auth_client.put(f"/api/final-tests/{test['id']}/answers", json={"question_id": first, "answer": "right"})
    await database.final_tests.update_one(
        {"_id": ObjectId(test["id"])}, {"$set": {"started_at": datetime.now(UTC) - timedelta(hours=1)}}
    )

    loaded = (await auth_client.get(f"/api/final-tests/{test['id']}")).json()

    assert loaded["submitted"] is True
    assert loaded["result"]["finished_by"] == "time_up"
    assert loaded["result"]["correct"] == 1
    late = await auth_client.put(f"/api/final-tests/{test['id']}/answers", json={"question_id": first, "answer": "x"})
    assert late.status_code == 409


async def test_question_status_is_saved_for_the_navigator(auth_client, fake_ai):
    test = await _start(auth_client, fake_ai)
    first, second, _ = (question["id"] for question in test["questions"])

    await auth_client.put(f"/api/final-tests/{test['id']}/status", json={"question_id": first, "flagged": True, "visited": True})
    await auth_client.put(f"/api/final-tests/{test['id']}/status", json={"question_id": second, "visited": True})
    loaded = (await auth_client.get(f"/api/final-tests/{test['id']}")).json()
    assert loaded["flagged"] == [first]
    assert set(loaded["visited"]) == {first, second}

    await auth_client.put(f"/api/final-tests/{test['id']}/status", json={"question_id": first, "flagged": False})
    loaded = (await auth_client.get(f"/api/final-tests/{test['id']}")).json()
    assert loaded["flagged"] == []


async def _complete_every_python_topic(client, database) -> None:
    """Store progress that meets every completion requirement, so the course exam unlocks."""
    from app.db.seed import PYTHON_TOPICS

    user_id = (await client.get("/api/auth/me")).json()["id"]
    await database.topic_progress.insert_many(
        [
            {
                "user_id": user_id,
                "topic_slug": topic["slug"],
                "questions_attempted": 10,
                "correct_answers": 10,
                "accuracy": 100.0,
                "mastery": "mastered",
                "current_difficulty": "beginner",
                "concept_stats": [{"concept": c, "attempted": 1, "correct": 1} for c in topic["key_concepts"]],
                "recent_results": [],
                "last_answers": [True] * 10,
                "final_test_passed": True,
                "best_final_test_accuracy": 90.0,
                "last_attempted_at": None,
            }
            for topic in PYTHON_TOPICS
        ]
    )


def _course_exam_response(extra_unknown_topic: bool = False):
    from app.db.seed import PYTHON_TOPICS
    from app.schemas.final_test import CourseExamResponse

    questions = [
        {**_question(0).model_dump(), "topic_slug": topic["slug"], "concept": topic["key_concepts"][0]}
        for topic in PYTHON_TOPICS
        for _ in range(2)
    ]
    if extra_unknown_topic:
        questions.append({**_question(0).model_dump(), "topic_slug": "not-a-real-topic"})
    return CourseExamResponse(questions=questions)


async def test_course_exam_is_locked_until_every_topic_is_complete(auth_client):
    response = await auth_client.post("/api/final-tests", json={"subject_slug": "python"})
    assert response.status_code == 409
    assert "Still to complete" in response.json()["detail"]

    progress = (await auth_client.get("/api/progress")).json()
    assert progress["course_exam_unlocked"] is False
    assert len(progress["topics_remaining"]) == 9


async def test_passing_the_topic_test_meets_the_final_requirement(auth_client, fake_ai):
    test = await _start(auth_client, fake_ai)
    answers = {question["id"]: "right" for question in test["questions"]}

    result = (await auth_client.post(f"/api/final-tests/{test['id']}/submit", json={"answers": answers})).json()["result"]
    assert result["passed"] is True
    assert result["remarks"][0].startswith("Passed!")

    progress = (await auth_client.get("/api/progress/loops")).json()
    assert progress["final_test_passed"] is True
    assert progress["requirements"][3]["met"] is True


async def test_passing_the_course_exam_completes_the_course(auth_client, fake_ai, database):
    from app.schemas.final_test import CourseExamResponse

    await _complete_every_python_topic(auth_client, database)
    fake_ai.responses[CourseExamResponse] = _course_exam_response()
    exam = (await auth_client.post("/api/final-tests", json={"subject_slug": "python"})).json()
    answers = {question["id"]: "right" for question in exam["questions"]}

    result = (await auth_client.post(f"/api/final-tests/{exam['id']}/submit", json={"answers": answers})).json()["result"]
    assert result["passed"] is True

    progress = (await auth_client.get("/api/progress")).json()
    assert progress["course_exam_passed"] is True
    assert progress["course_completed"] is True
    assert progress["completion_percent"] == 100


async def test_course_exam_covers_every_topic_and_reports_by_topic(auth_client, fake_ai, database):
    from app.db.seed import PYTHON_TOPICS
    from app.schemas.final_test import CourseExamResponse

    await _complete_every_python_topic(auth_client, database)
    fake_ai.responses[CourseExamResponse] = _course_exam_response(extra_unknown_topic=True)
    response = await auth_client.post("/api/final-tests", json={"subject_slug": "python"})
    assert response.status_code == 201
    exam = response.json()
    assert exam["scope"] == "course"
    assert exam["title"] == "Python course exam"
    assert len(exam["questions"]) == len(PYTHON_TOPICS) * 2  # the unknown topic was dropped
    assert exam["time_limit_seconds"] == len(PYTHON_TOPICS) * 2 * 90

    answers = {question["id"]: "right" for question in exam["questions"][:2]}
    result = (await auth_client.post(f"/api/final-tests/{exam['id']}/submit", json={"answers": answers})).json()["result"]

    assert len(result["topic_scores"]) == len(PYTHON_TOPICS)
    assert result["topic_scores"][0] == {
        "topic_slug": PYTHON_TOPICS[0]["slug"], "topic_name": PYTHON_TOPICS[0]["name"], "correct": 2, "total": 2
    }
    assert result["strong_areas"] == [PYTHON_TOPICS[0]["name"]]
    assert result["review"][0]["topic_name"] == PYTHON_TOPICS[0]["name"]


async def test_start_requires_exactly_one_scope(auth_client):
    response = await auth_client.post("/api/final-tests", json={"topic_slug": "loops", "subject_slug": "python"})
    assert response.status_code == 422


async def test_two_new_attempts_are_allowed_after_passing(auth_client, fake_ai):
    test = await _start(auth_client, fake_ai)
    answers = {question["id"]: "right" for question in test["questions"]}
    await auth_client.post(f"/api/final-tests/{test['id']}/submit", json={"answers": answers})

    progress = (await auth_client.get("/api/progress/loops")).json()
    assert progress["final_test_attempts_left"] == 2

    for left in (1, 0):
        response = await auth_client.post("/api/final-tests", json={"topic_slug": "loops"})
        assert response.status_code == 201
        assert (await auth_client.get("/api/progress/loops")).json()["final_test_attempts_left"] == left

    blocked = await auth_client.post("/api/final-tests", json={"topic_slug": "loops"})
    assert blocked.status_code == 409


async def test_three_failed_attempts_in_a_row_lock_the_topic_test(auth_client, fake_ai, database):
    for attempt in (1, 2, 3):
        test = await _start(auth_client, fake_ai)
        finished = (await auth_client.post(f"/api/final-tests/{test['id']}/submit", json={"answers": {}})).json()
        assert finished["result"]["passed"] is False
        assert finished["result"]["fails_in_row"] == attempt

    assert finished["result"]["retry_available_at"] is not None
    progress = (await auth_client.get("/api/progress/loops")).json()
    assert progress["final_test_locked_until"] is not None

    locked = await auth_client.post("/api/final-tests", json={"topic_slug": "loops"})
    assert locked.status_code == 409
    assert "locked" in locked.json()["detail"]

    # Once the cooldown has passed, the learner gets a fresh set of attempts.
    user_id = (await auth_client.get("/api/auth/me")).json()["id"]
    await database.topic_progress.update_one(
        {"user_id": user_id, "topic_slug": "loops"},
        {"$set": {"final_test_locked_until": datetime.now(UTC) - timedelta(minutes=1)}},
    )
    assert (await auth_client.get("/api/progress/loops")).json()["final_test_locked_until"] is None
    assert (await auth_client.post("/api/final-tests", json={"topic_slug": "loops"})).status_code == 201


async def test_passing_resets_the_failed_attempt_count(auth_client, fake_ai):
    test = await _start(auth_client, fake_ai)
    await auth_client.post(f"/api/final-tests/{test['id']}/submit", json={"answers": {}})
    test = await _start(auth_client, fake_ai)
    answers = {question["id"]: "right" for question in test["questions"]}
    await auth_client.post(f"/api/final-tests/{test['id']}/submit", json={"answers": answers})

    progress = (await auth_client.get("/api/progress/loops")).json()
    assert progress["final_test_fails_in_row"] == 0
    assert progress["final_test_passed"] is True
    assert progress["final_test_best"] == 100.0


async def test_a_failed_course_exam_cools_down_for_12_hours(auth_client, fake_ai, database):
    from app.schemas.final_test import CourseExamResponse

    await _complete_every_python_topic(auth_client, database)
    fake_ai.responses[CourseExamResponse] = _course_exam_response()
    exam = (await auth_client.post("/api/final-tests", json={"subject_slug": "python"})).json()
    result = (await auth_client.post(f"/api/final-tests/{exam['id']}/submit", json={"answers": {}})).json()["result"]

    assert result["passed"] is False
    retry_at = datetime.fromisoformat(result["retry_available_at"])
    assert timedelta(hours=11, minutes=59) < retry_at - datetime.now(UTC) <= timedelta(hours=12)
    assert (await auth_client.get("/api/progress")).json()["course_exam_locked_until"] is not None

    retake = await auth_client.post("/api/final-tests", json={"subject_slug": "python"})
    assert retake.status_code == 409


async def test_results_from_before_progress_recording_are_backfilled(auth_client, database):
    from app.services.progress_service import backfill_final_test_results

    user_id = (await auth_client.get("/api/auth/me")).json()["id"]
    await database.topic_progress.insert_one(
        {"user_id": user_id, "topic_slug": "operators", "current_difficulty": "beginner"}
    )
    # An old-style test document: no scope or subject, result without pass fields.
    await database.final_tests.insert_one(
        {"user_id": user_id, "topic_slug": "operators", "result": {"accuracy": 80.0}}
    )

    await backfill_final_test_results()

    progress = (await auth_client.get("/api/progress/operators")).json()
    assert progress["final_test_passed"] is True
    assert progress["final_test_best"] == 80.0


async def test_a_passed_course_exam_cannot_be_retaken(auth_client, fake_ai, database):
    from app.schemas.final_test import CourseExamResponse

    await _complete_every_python_topic(auth_client, database)
    fake_ai.responses[CourseExamResponse] = _course_exam_response()
    exam = (await auth_client.post("/api/final-tests", json={"subject_slug": "python"})).json()
    answers = {question["id"]: "right" for question in exam["questions"]}
    await auth_client.post(f"/api/final-tests/{exam['id']}/submit", json={"answers": answers})

    retake = await auth_client.post("/api/final-tests", json={"subject_slug": "python"})
    assert retake.status_code == 409
    assert "already completed" in retake.json()["detail"]