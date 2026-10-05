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
    starter_code=None,
    test_cases=[],
)


async def _start_session(client, mode: str, topic: str = "loops") -> str:
    response = await client.post("/api/sessions", json={"topic_slug": topic, "mode": mode})
    assert response.status_code == 201
    return response.json()["id"]


async def test_learn_mode_returns_lesson_and_saves_history(auth_client, fake_ai):
    fake_ai.responses[LessonResponse] = LessonResponse(
        message="A for loop repeats code for each item.\n\n```python\nfor i in range(3):\n    print(i)\n```",
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


def _verdict(correct: bool, feedback: str) -> EvaluationResponse:
    return EvaluationResponse(
        correct=correct,
        score=100 if correct else 0,
        feedback=feedback,
        hint=None if correct else "Think about the first value.",
        correct_answer=None,
        concept="range()",
        difficulty="beginner",
    )


async def _answer(client, fake_ai, answer: str) -> dict:
    fake_ai.responses[QuestionResponse] = PREDICT_QUESTION
    session_id = await _start_session(client, "practice")
    question = (await client.post("/api/tutor/practice", json={"session_id": session_id})).json()
    return (await client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": answer})).json()


async def test_output_formatting_differences_are_accepted_without_the_ai(auth_client, fake_ai):
    # Quotes, spacing and capitalization don't matter; no AI verdict is configured or needed.
    result = await _answer(auth_client, fake_ai, "'0'  '1'  '2'")
    assert result["correct"] is True


async def test_ai_decides_near_misses_on_predict_output(auth_client, fake_ai):
    fake_ai.responses[EvaluationResponse] = _verdict(True, "Right result! The exact output is 0, 1 and 2 on separate lines.")
    result = await _answer(auth_client, fake_ai, "zero, one, two")
    assert result["correct"] is True
    assert "exact output" in result["feedback"]


async def test_ai_can_still_reject_a_different_result(auth_client, fake_ai):
    fake_ai.responses[EvaluationResponse] = _verdict(False, "Close! Remember where range starts.")
    result = await _answer(auth_client, fake_ai, "1 2 3")
    assert result["correct"] is False
    assert result["feedback"] == "Close! Remember where range starts."


async def test_multiple_choice_is_never_overruled_by_the_ai(auth_client, fake_ai):
    fake_ai.responses[QuestionResponse] = PREDICT_QUESTION.model_copy(
        update={"question_type": "multiple_choice", "options": ["0 1 2", "1 2 3"], "correct_answer": "0 1 2", "code": None}
    )
    fake_ai.responses[EvaluationResponse] = _verdict(True, "Looks right.")
    session_id = await _start_session(auth_client, "practice")
    question = (await auth_client.post("/api/tutor/practice", json={"session_id": session_id})).json()
    result = (await auth_client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": "1 2 3"})).json()
    assert result["correct"] is False


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
                starter_code=None,
                test_cases=[],
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
    fake_ai.responses[LessonResponse] = LessonResponse(message="Loops repeat code.", on_topic=True)
    first = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn", "resume": True})).json()
    await auth_client.post("/api/tutor/learn", json={"session_id": first["id"], "message": "Hi"})

    resumed = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn", "resume": True})).json()
    fresh = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})).json()

    assert resumed["id"] == first["id"]
    assert len(resumed["messages"]) == 2
    assert fresh["id"] != first["id"]
    assert fresh["messages"] == []


async def test_learn_history_lists_past_conversations(auth_client, fake_ai):
    fake_ai.responses[LessonResponse] = LessonResponse(message="Loops repeat code.", on_topic=True)
    first = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})).json()
    await auth_client.post("/api/tutor/learn", json={"session_id": first["id"], "message": "What is a while loop?"})
    second = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})).json()
    await auth_client.post("/api/tutor/learn", json={"session_id": second["id"], "message": "Explain range()"})
    await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})  # empty: not listed

    history = (await auth_client.get("/api/sessions", params={"topic_slug": "loops"})).json()

    assert [item["id"] for item in history] == [second["id"], first["id"]]
    assert history[1]["preview"] == "What is a while loop?"
    assert history[1]["message_count"] == 2


async def test_attached_file_reaches_the_ai_but_is_never_stored(auth_client, fake_ai, database):
    fake_ai.responses[LessonResponse] = LessonResponse(message="Your loop counts from 0.", on_topic=True)
    session = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})).json()
    secret = "for n in range(3): print(n)  # SECRET-FILE-CONTENT"

    first = await auth_client.post(
        "/api/tutor/learn",
        json={"session_id": session["id"], "message": "", "attachments": [{"name": "loop.py", "text": secret, "new": True}]},
    )
    assert first.status_code == 200
    # A follow-up resends the file (now not new), as the browser does.
    await auth_client.post(
        "/api/tutor/learn",
        json={"session_id": session["id"], "message": "Why 0?", "attachments": [{"name": "loop.py", "text": secret}]},
    )

    assert all("SECRET-FILE-CONTENT" in prompt for prompt in fake_ai.prompts[-2:])
    stored = await database.sessions.find_one({"_id": __import__("bson").ObjectId(session["id"])})
    assert "SECRET-FILE-CONTENT" not in str(stored)
    student = [message for message in stored["messages"] if message["role"] == "student"]
    assert student[0]["attachments"] == ["loop.py"]  # only the name, on the message it was attached to
    assert student[1]["attachments"] == []


async def test_attachment_limits_are_enforced(auth_client):
    session = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})).json()
    too_many = [{"name": f"f{i}.txt", "text": "x"} for i in range(4)]
    response = await auth_client.post(
        "/api/tutor/learn", json={"session_id": session["id"], "message": "Hi", "attachments": too_many}
    )
    assert response.status_code == 422