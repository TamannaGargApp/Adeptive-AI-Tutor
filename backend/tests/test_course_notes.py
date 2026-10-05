"""Admin course notes: storage, retrieval, blending into prompts, and admin-only source labels."""

from app.core.config import get_settings
from app.schemas.tutor import LessonResponse
from app.services.notes_service import select_relevant, split_into_chunks

NOTES = """# Loops

## The for loop
A for loop repeats code once for each item. NOTES-MARKER-FOR-LOOP

## While loops
A while loop repeats while its condition stays true.

## Decorators
Decorators wrap functions. Unrelated to loops.
"""


def test_notes_are_split_by_heading():
    chunks = split_into_chunks(NOTES)
    assert [chunk["heading"] for chunk in chunks] == ["The for loop", "While loops", "Decorators"]


def test_only_matching_sections_are_selected():
    chunks = split_into_chunks(NOTES)
    selected = select_relevant(chunks, "How does a for loop work?", budget=5000)
    assert selected[0]["heading"] == "The for loop"
    assert all(chunk["heading"] != "Decorators" for chunk in selected)
    assert select_relevant(chunks, "pizza toppings", budget=5000) == []


async def _upload(client, monkeypatch) -> dict:
    monkeypatch.setattr(get_settings(), "admin_emails", "ada@example.com")
    response = await client.post("/api/admin/topics/loops/notes", json={"file_name": "loops.md", "text": NOTES})
    assert response.status_code == 201
    return response.json()


async def test_only_admins_can_upload_notes(auth_client):
    response = await auth_client.post("/api/admin/topics/loops/notes", json={"file_name": "x.md", "text": NOTES})
    assert response.status_code == 403


async def test_notes_reach_the_ai_and_labels_are_for_admins_only(auth_client, fake_ai, monkeypatch):
    uploaded = await _upload(auth_client, monkeypatch)
    assert (uploaded["file_name"], uploaded["sections"]) == ("loops.md", 3)

    fake_ai.responses[LessonResponse] = LessonResponse(message="A for loop repeats code.", on_topic=True)
    session = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "learn"})).json()

    as_admin = (await auth_client.post("/api/tutor/learn", json={"session_id": session["id"], "message": "What is a for loop?"})).json()
    assert "NOTES-MARKER-FOR-LOOP" in fake_ai.prompts[-1]
    assert as_admin["reply"]["notes_sources"] == ["loops.md"]

    monkeypatch.setattr(get_settings(), "admin_emails", "")  # now an ordinary learner
    as_learner = (await auth_client.post("/api/tutor/learn", json={"session_id": session["id"], "message": "And a for loop again?"})).json()
    assert "NOTES-MARKER-FOR-LOOP" in fake_ai.prompts[-1]
    assert as_learner["reply"]["notes_sources"] == []
    history = (await auth_client.get(f"/api/sessions/{session['id']}")).json()
    assert all(message["notes_sources"] == [] for message in history["messages"])


async def test_admin_can_remove_notes(auth_client, fake_ai, monkeypatch):
    uploaded = await _upload(auth_client, monkeypatch)
    assert (await auth_client.delete(f"/api/admin/notes/{uploaded['id']}")).status_code == 204
    assert (await auth_client.get("/api/admin/topics/loops/notes")).json() == []