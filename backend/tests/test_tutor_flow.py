from app.schemas.quiz import QuizResponse
from app.schemas.tutor import EvaluationResponse, LessonResponse, QuestionResponse

PREDICT_QUESTION = QuestionResponse(
    question_type="predict_output",
    prompt="What will this code print?",
    code="for i in range(3):\n    print(i)",
    options=[],
    correct_answer="0\n1\n2",
    explanation="range(3) produces 0, 1 and 2.",
    concept="range()",
    hint="range(n) starts counting at 0.",
)


async def _start_session(client, mode: str, topic: str = "loops") -> str:
    response = await client.post("/api/sessions", json={"topic_slug": topic, "mode": mode})
    assert response.status_code == 201
    return response.json()["id"]


async def test_learn_mode_returns_lesson_and_saves_history(auth_client, fake_ai):
    fake_ai.responses[LessonResponse] = LessonResponse(
        explanation="A for loop repeats code for each item.",
        example_code="for i in range(3):\n    print(i)",
        example_explanation="It prints 0, 1 and 2.",
        check_question="What does range(2) produce?",
        on_topic=True,
    )
    session_id = await _start_session(auth_client, "learn")

    response = await auth_client.post("/api/tutor/learn", json={"session_id": session_id, "message": "What is a for loop?"})

    assert response.status_code == 200
    assert "```python" in response.json()["reply"]["content"]
    session = (await auth_client.get(f"/api/sessions/{session_id}")).json()
    assert [message["role"] for message in session["messages"]] == ["student", "tutor"]


async def test_practice_question_hides_answer_and_tracks_progress(auth_client, fake_ai, database):
    fake_ai.responses[QuestionResponse] = PREDICT_QUESTION
    # No EvaluationResponse configured: the fake AI fails, which exercises the fallback feedback path.
    session_id = await _start_session(auth_client, "practice")

    question = (await auth_client.post("/api/tutor/practice", json={"session_id": session_id})).json()
    assert "correct_answer" not in question
    assert question["question_type"] == "predict_output"

    wrong = (await auth_client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": "1 2 3"})).json()
    assert wrong["correct"] is False
    assert wrong["correct_answer"] is None
    assert wrong["hint"]
    assert wrong["can_retry"] is True

    right = (await auth_client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": "0 1 2"})).json()
    assert right["correct"] is True
    assert right["correct_answer"] == "0\n1\n2"

    progress = (await auth_client.get("/api/progress/loops")).json()
    assert progress["questions_attempted"] == 1  # only the first attempt counts
    assert progress["correct_answers"] == 0
    assert await database.attempts.count_documents({}) == 2


async def test_ai_feedback_is_used_when_available(auth_client, fake_ai):
    fake_ai.responses[QuestionResponse] = PREDICT_QUESTION
    fake_ai.responses[EvaluationResponse] = EvaluationResponse(
        correct=True,  # deliberately wrong: code grading must win over the AI verdict
        score=100,
        feedback="Close! Remember where range starts.",
        hint="Think about the first value.",
        correct_answer=None,
        concept="range()",
        difficulty="beginner",
    )
    session_id = await _start_session(auth_client, "practice")
    question = (await auth_client.post("/api/tutor/practice", json={"session_id": session_id})).json()

    result = (await auth_client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": "1 2 3"})).json()

    assert result["correct"] is False
    assert result["feedback"] == "Close! Remember where range starts."


async def test_quiz_flow_produces_result_and_recommendation(auth_client, fake_ai):
    fake_ai.responses[QuizResponse] = QuizResponse(
        questions=[
            QuestionResponse(
                question_type="multiple_choice",
                prompt=f"Question {number}",
                code=None,
                options=["A answer", "B answer", "C answer"],
                correct_answer="A answer",
                explanation="Because.",
                concept=f"concept {number}",
                hint="Think.",
            )
            for number in range(5)
        ]
    )
    session_id = await _start_session(auth_client, "quiz")

    quiz = (await auth_client.post("/api/tutor/quiz", json={"session_id": session_id})).json()
    assert len(quiz["questions"]) == 5

    for index, question in enumerate(quiz["questions"]):
        answer = "A answer" if index < 4 else "B answer"
        response = await auth_client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": answer})
        assert response.status_code == 200

    repeat = await auth_client.post("/api/tutor/evaluate", json={"question_id": quiz["questions"][0]["id"], "answer": "A answer"})
    assert repeat.status_code == 409

    result = (await auth_client.get(f"/api/tutor/quiz/{session_id}/result")).json()
    assert result["correct"] == 4
    assert result["accuracy"] == 80.0
    assert result["needs_practice"] == ["concept 4"]
    assert result["recommendation"]["topic_slug"]


async def test_tutor_reports_missing_ai_configuration(auth_client):
    session_id = await _start_session(auth_client, "practice")
    response = await auth_client.post("/api/tutor/practice", json={"session_id": session_id})
    assert response.status_code == 503


async def test_quiz_feedback_shows_answer_without_hint(auth_client, fake_ai):
    fake_ai.responses[QuizResponse] = QuizResponse(questions=[PREDICT_QUESTION])
    session_id = await _start_session(auth_client, "quiz")
    quiz = (await auth_client.post("/api/tutor/quiz", json={"session_id": session_id})).json()

    result = (
        await auth_client.post("/api/tutor/evaluate", json={"question_id": quiz["questions"][0]["id"], "answer": "1 2 3"})
    ).json()

    assert result["correct"] is False
    assert result["hint"] is None
    assert result["correct_answer"] == "0\n1\n2"
    assert result["explanation"]


async def test_learn_mode_resumes_the_latest_conversation(auth_client, fake_ai):
    fake_ai.responses[LessonResponse] = LessonResponse(
        explanation="Loops repeat code.", example_code=None, example_explanation=None, check_question=None, on_topic=True
    )
    first = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn", "resume": True})).json()
    await auth_client.post("/api/tutor/learn", json={"session_id": first["id"], "message": "Hi"})

    resumed = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn", "resume": True})).json()
    fresh = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})).json()

    assert resumed["id"] == first["id"]
    assert len(resumed["messages"]) == 2
    assert fresh["id"] != first["id"]
    assert fresh["messages"] == []


async def test_learn_history_lists_past_conversations(auth_client, fake_ai):
    fake_ai.responses[LessonResponse] = LessonResponse(
        explanation="Loops repeat code.", example_code=None, example_explanation=None, check_question=None, on_topic=True
    )
    first = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})).json()
    await auth_client.post("/api/tutor/learn", json={"session_id": first["id"], "message": "What is a while loop?"})
    second = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})).json()
    await auth_client.post("/api/tutor/learn", json={"session_id": second["id"], "message": "Explain range()"})
    await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})  # empty: not listed

    history = (await auth_client.get("/api/sessions", params={"topic_slug": "loops"})).json()

    assert [item["id"] for item in history] == [second["id"], first["id"]]
    assert history[1]["preview"] == "What is a while loop?"
    assert history[1]["message_count"] == 2