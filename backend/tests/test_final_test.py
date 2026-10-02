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