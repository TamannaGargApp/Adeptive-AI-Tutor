"""Study sets, with files stored in a temporary local folder (no AWS needed for tests)."""

import base64

import pytest

from app.core.config import get_settings
from app.schemas.study_set import (
    FlashcardItem,
    FlashcardsResponse,
    StudyChatResponse,
    StudyQuizQuestion,
    StudyQuizResponse,
    StudySummaryResponse,
)
from app.services.file_storage import get_file_storage

MATERIAL = "Photosynthesis lets plants turn light, water and carbon dioxide into glucose and oxygen. " * 3


@pytest.fixture(autouse=True)
def local_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "storage_backend", "local")
    monkeypatch.setattr(get_settings(), "local_storage_dir", str(tmp_path))
    get_file_storage.cache_clear()
    yield tmp_path
    get_file_storage.cache_clear()


async def _create(client, with_file: bool = True) -> dict:
    body = {"title": "Biology: photosynthesis", "file_name": "photo.txt", "content_type": "text/plain", "text": MATERIAL}
    if with_file:
        body["file_base64"] = base64.b64encode(MATERIAL.encode()).decode()
    response = await client.post("/api/study-sets", json=body)
    assert response.status_code == 201
    return response.json()


async def test_creating_a_set_stores_the_file_outside_the_database(auth_client, database, local_storage):
    created = await _create(auth_client)
    assert created["tools_ready"] == []

    stored = await database.study_sets.find_one({})
    assert "Photosynthesis" not in str(stored)  # the material lives in file storage, not MongoDB
    assert any(local_storage.rglob("text.txt")) and any(local_storage.rglob("original"))

    download = await auth_client.get(f"/api/study-sets/{created['id']}/download")
    assert download.status_code == 200
    assert download.content.decode().startswith("Photosynthesis")


async def test_tools_are_generated_once_then_saved(auth_client, fake_ai):
    created = await _create(auth_client)
    fake_ai.responses[StudySummaryResponse] = StudySummaryResponse(
        overview="How plants make food.", key_points=["Light becomes chemical energy."], key_terms=[]
    )
    first = (await auth_client.post(f"/api/study-sets/{created['id']}/tools/summary")).json()
    again = (await auth_client.post(f"/api/study-sets/{created['id']}/tools/summary")).json()

    assert first["summary"]["overview"] == "How plants make food."
    assert again["tools_ready"] == ["summary"]
    assert fake_ai.calls.count("StudySummaryResponse") == 1
    assert "Photosynthesis" in fake_ai.prompts[-1]  # the material was read back from storage


async def test_flashcards_track_progress_and_quiz_results_are_kept(auth_client, fake_ai):
    created = await _create(auth_client, with_file=False)
    fake_ai.responses[FlashcardsResponse] = FlashcardsResponse(
        cards=[FlashcardItem(front="What does photosynthesis make?", back="Glucose and oxygen."),
               FlashcardItem(front="What do plants need?", back="Light, water and CO2.")]
    )
    fake_ai.responses[StudyQuizResponse] = StudyQuizResponse(
        questions=[StudyQuizQuestion(question="Output?", options=["Glucose", "Salt"], correct_option=0, explanation="")]
    )
    cards = (await auth_client.post(f"/api/study-sets/{created['id']}/tools/flashcards")).json()["flashcards"]
    known = (
        await auth_client.put(
            f"/api/study-sets/{created['id']}/flashcards/progress", json={"known_card_ids": [cards[0]["id"], "fake-id"]}
        )
    ).json()
    assert known["known_card_ids"] == [cards[0]["id"]]
    assert (known["flashcards_known"], known["flashcards_total"]) == (1, 2)

    await auth_client.post(f"/api/study-sets/{created['id']}/tools/quiz")
    result = (await auth_client.post(f"/api/study-sets/{created['id']}/quiz-result", json={"score": 1, "total": 1})).json()
    assert result["last_quiz"] == {"score": 1, "total": 1}


async def test_study_set_tutor_and_deletion(auth_client, fake_ai, local_storage):
    created = await _create(auth_client)
    fake_ai.responses[StudyChatResponse] = StudyChatResponse(message="Plants make glucose.", on_topic=True)
    reply = (await auth_client.post(f"/api/study-sets/{created['id']}/chat", json={"message": "What do plants make?"})).json()
    assert reply["reply"]["content"] == "Plants make glucose."
    detail = (await auth_client.get(f"/api/study-sets/{created['id']}")).json()
    assert [message["role"] for message in detail["chat"]] == ["student", "tutor"]

    assert (await auth_client.delete(f"/api/study-sets/{created['id']}")).status_code == 204
    assert (await auth_client.get(f"/api/study-sets/{created['id']}")).status_code == 404
    assert not any(path.is_file() for path in local_storage.rglob("*"))


async def test_other_learners_cannot_open_a_set(auth_client, client):
    created = await _create(auth_client)
    from tests.conftest import register

    await client.post("/api/auth/logout")
    await register(client, email="someone@example.com", name="Someone")
    assert (await client.get(f"/api/study-sets/{created['id']}")).status_code == 404


async def test_new_flashcards_dont_repeat_and_keep_progress(auth_client, fake_ai):
    created = await _create(auth_client, with_file=False)
    fake_ai.responses[FlashcardsResponse] = FlashcardsResponse(
        cards=[FlashcardItem(front="What does photosynthesis make?", back="Glucose and oxygen.")]
    )
    cards = (await auth_client.post(f"/api/study-sets/{created['id']}/tools/flashcards")).json()["flashcards"]
    await auth_client.put(
        f"/api/study-sets/{created['id']}/flashcards/progress", json={"known_card_ids": [cards[0]["id"]]}
    )

    fake_ai.responses[FlashcardsResponse] = FlashcardsResponse(
        cards=[
            FlashcardItem(front="what does Photosynthesis make", back="Repeat, reworded."),
            FlashcardItem(front="Where does photosynthesis happen?", back="In chloroplasts."),
        ]
    )
    more = (await auth_client.post(f"/api/study-sets/{created['id']}/flashcards/more")).json()
    assert "What does photosynthesis make?" in fake_ai.prompts[-1]  # existing cards are sent to avoid
    assert [card["front"] for card in more["study_set"]["flashcards"]] == [
        "What does photosynthesis make?",
        "Where does photosynthesis happen?",
    ]
    assert len(more["new_card_ids"]) == 1
    assert more["study_set"]["known_card_ids"] == [cards[0]["id"]]

    # Only repeats come back: nothing new to add.
    fake_ai.responses[FlashcardsResponse] = FlashcardsResponse(
        cards=[FlashcardItem(front="Where does photosynthesis happen?", back="Again.")]
    )
    assert (await auth_client.post(f"/api/study-sets/{created['id']}/flashcards/more")).status_code == 400


async def test_a_new_quiz_avoids_the_previous_questions(auth_client, fake_ai):
    created = await _create(auth_client, with_file=False)
    fake_ai.responses[StudyQuizResponse] = StudyQuizResponse(
        questions=[
            StudyQuizQuestion(question="What is glucose?", options=["A sugar", "A salt"], correct_option=0, explanation="")
        ]
    )
    await auth_client.post(f"/api/study-sets/{created['id']}/tools/quiz")
    await auth_client.post(f"/api/study-sets/{created['id']}/tools/quiz?regenerate=true")
    assert "Do NOT repeat" in fake_ai.prompts[-1] and "What is glucose?" in fake_ai.prompts[-1]