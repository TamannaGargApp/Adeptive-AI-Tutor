"""Study sets: a learner's material turned into notes, a summary, flashcards, a quiz and a tutor.

The original file and its extracted text go to file storage (AWS S3, or a local folder in
development). The generated study aids, flashcard progress, quiz results and tutor chat are kept in
MongoDB. Each tool is generated the first time it's opened, then saved.
"""

import base64
import binascii
import uuid
from datetime import UTC, datetime

from bson import ObjectId

from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.db.mongodb import get_database, to_object_id
from app.models.user import User
from app.prompts.study_set_prompt import STUDY_SET_SYSTEM_PROMPT, build_study_chat_prompt, build_tool_prompt
from app.schemas.study_set import (
    MAX_FILE_BYTES,
    STUDY_TOOLS,
    FlashcardsResponse,
    QuizResult,
    StudyChatReply,
    StudyChatResponse,
    StudyNotesResponse,
    StudyQuizResponse,
    StudySetChatMessage,
    StudySetCreate,
    StudySetOut,
    StudySetSummary,
    StudySummaryResponse,
)
from app.services.ai_service import StructuredLLM
from app.services.file_storage import get_file_storage

MAX_STUDY_SETS = 20
# How much of the material goes into one prompt.
MATERIAL_PROMPT_CHARS = 60_000
CHAT_HISTORY_LIMIT = 12
MAX_FLASHCARDS = 120
ALLOWED_CONTENT_TYPES = {"application/pdf", "text/plain", "text/markdown", "text/x-markdown", ""}

TOOL_MODELS = {
    "notes": StudyNotesResponse,
    "summary": StudySummaryResponse,
    "flashcards": FlashcardsResponse,
    "quiz": StudyQuizResponse,
}


def _keys(user_id: str, set_id: str) -> tuple[str, str]:
    folder = f"users/{user_id}/study-sets/{set_id}"
    return f"{folder}/original", f"{folder}/text.txt"


async def _get_document(user: User, set_id: str) -> dict:
    object_id = to_object_id(set_id)
    document = None
    if object_id is not None:
        document = await get_database().study_sets.find_one({"_id": object_id, "user_id": user.id})
    if document is None:
        raise NotFoundError("Study set not found.")
    return document


async def _material(document: dict) -> str:
    text = (await get_file_storage().load(document["text_key"])).decode("utf-8")
    return text[:MATERIAL_PROMPT_CHARS]


# ---------- Creating, listing, deleting ----------


async def create_study_set(user: User, data: StudySetCreate) -> StudySetSummary:
    db = get_database()
    if await db.study_sets.count_documents({"user_id": user.id}) >= MAX_STUDY_SETS:
        raise ConflictError(f"You can have up to {MAX_STUDY_SETS} study sets. Delete one to add another.")
    if data.content_type not in ALLOWED_CONTENT_TYPES:
        raise AppError("Study sets can be made from PDF, text or Markdown files.")

    original = None
    if data.file_base64:
        try:
            original = base64.b64decode(data.file_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise AppError("The file couldn't be read. Please try again.") from exc
        if len(original) > MAX_FILE_BYTES:
            raise AppError("Files can be up to 10 MB.")

    set_id = ObjectId()
    file_key, text_key = _keys(user.id, str(set_id))
    storage = get_file_storage()
    await storage.save(text_key, data.text.encode("utf-8"), "text/plain; charset=utf-8")
    if original is not None:
        await storage.save(file_key, original, data.content_type or "application/octet-stream")

    document = {
        "_id": set_id,
        "user_id": user.id,
        "title": data.title.strip(),
        "file_name": data.file_name,
        "content_type": data.content_type,
        "file_key": file_key if original is not None else None,
        "text_key": text_key,
        "text_chars": len(data.text),
        "created_at": datetime.now(UTC),
        "known_card_ids": [],
        "chat": [],
    }
    await db.study_sets.insert_one(document)
    return _summary(document)


async def list_study_sets(user: User) -> list[StudySetSummary]:
    cursor = get_database().study_sets.find({"user_id": user.id}).sort("created_at", -1)
    return [_summary(document) async for document in cursor]


async def get_study_set(user: User, set_id: str) -> StudySetOut:
    return _detail(await _get_document(user, set_id))


async def delete_study_set(user: User, set_id: str) -> None:
    document = await _get_document(user, set_id)
    storage = get_file_storage()
    for key in (document.get("file_key"), document["text_key"]):
        if key:
            await storage.delete(key)
    await get_database().study_sets.delete_one({"_id": document["_id"]})


async def download_link(user: User, set_id: str) -> tuple[str | None, bytes | None, dict]:
    """A presigned S3 link, or (with local storage) the file bytes to stream."""
    document = await _get_document(user, set_id)
    if not document.get("file_key"):
        raise NotFoundError("The original file wasn't saved for this study set.")
    storage = get_file_storage()
    url = await storage.download_url(document["file_key"], document["file_name"])
    data = None if url else await storage.load(document["file_key"])
    return url, data, document


# ---------- AI tools ----------


async def generate_tool(user: User, set_id: str, tool: str, ai: StructuredLLM, regenerate: bool) -> StudySetOut:
    if tool not in STUDY_TOOLS:
        raise NotFoundError("Unknown study tool.")
    document = await _get_document(user, set_id)
    if document.get(tool) and not regenerate:
        return _detail(document)

    # A new quiz shouldn't repeat the questions the learner has just seen.
    avoid = None
    if tool == "quiz" and document.get("quiz"):
        avoid = [question["question"] for question in document["quiz"]["questions"]]
    result = await ai.generate_structured(
        system_prompt=STUDY_SET_SYSTEM_PROMPT,
        user_prompt=build_tool_prompt(tool, document["title"], await _material(document), avoid),
        response_model=TOOL_MODELS[tool],
    )
    value = result.model_dump()
    changes: dict = {tool: value}
    if tool == "flashcards":
        # Cards get ids so "known" progress can be tracked; new cards reset that progress.
        value["cards"] = [{**card, "id": uuid.uuid4().hex} for card in value["cards"]]
        changes["known_card_ids"] = []
    if tool == "quiz":
        changes["last_quiz"] = None
    await get_database().study_sets.update_one({"_id": document["_id"]}, {"$set": changes})
    return _detail({**document, **changes})


def _card_key(text: str) -> str:
    """Compare card questions ignoring case, spacing and punctuation, to catch near-duplicates."""
    return "".join(character for character in text.lower() if character.isalnum())


async def add_flashcards(user: User, set_id: str, ai: StructuredLLM) -> tuple[StudySetOut, list[str]]:
    """Add new flashcards that don't repeat the existing ones. Known-card progress is kept.
    Returns the updated set and the ids of the new cards."""
    document = await _get_document(user, set_id)
    existing = (document.get("flashcards") or {}).get("cards", [])
    if len(existing) >= MAX_FLASHCARDS:
        raise ConflictError(f"This deck has the maximum of {MAX_FLASHCARDS} cards.")

    result = await ai.generate_structured(
        system_prompt=STUDY_SET_SYSTEM_PROMPT,
        user_prompt=build_tool_prompt(
            "flashcards",
            document["title"],
            await _material(document),
            [card["front"] for card in existing],
            more=True,
        ),
        response_model=FlashcardsResponse,
    )
    seen = {_card_key(card["front"]) for card in existing}
    new_cards = []
    for card in result.cards:
        key = _card_key(card.front)
        if key and key not in seen:
            seen.add(key)
            new_cards.append({**card.model_dump(), "id": uuid.uuid4().hex})
    new_cards = new_cards[: MAX_FLASHCARDS - len(existing)]
    if not new_cards:
        raise AppError("Your deck already covers this material well. Try reviewing the cards you missed.")

    flashcards = {"cards": [*existing, *new_cards]}
    await get_database().study_sets.update_one({"_id": document["_id"]}, {"$set": {"flashcards": flashcards}})
    return _detail({**document, "flashcards": flashcards}), [card["id"] for card in new_cards]


async def save_flashcard_progress(user: User, set_id: str, known_card_ids: list[str]) -> StudySetOut:
    document = await _get_document(user, set_id)
    valid = {card["id"] for card in (document.get("flashcards") or {}).get("cards", [])}
    known = [card_id for card_id in dict.fromkeys(known_card_ids) if card_id in valid]
    await get_database().study_sets.update_one({"_id": document["_id"]}, {"$set": {"known_card_ids": known}})
    return _detail({**document, "known_card_ids": known})


async def save_quiz_result(user: User, set_id: str, result: QuizResult) -> StudySetOut:
    document = await _get_document(user, set_id)
    value = {**result.model_dump(), "at": datetime.now(UTC)}
    await get_database().study_sets.update_one({"_id": document["_id"]}, {"$set": {"last_quiz": value}})
    return _detail({**document, "last_quiz": value})


async def chat(user: User, set_id: str, message: str, ai: StructuredLLM) -> StudyChatReply:
    document = await _get_document(user, set_id)
    history = "\n".join(
        f"{item['role'].upper()}: {item['content']}" for item in document.get("chat", [])[-CHAT_HISTORY_LIMIT:]
    )
    response = await ai.generate_structured(
        system_prompt=STUDY_SET_SYSTEM_PROMPT,
        user_prompt=build_study_chat_prompt(document["title"], await _material(document), history, message.strip()),
        response_model=StudyChatResponse,
    )
    now = datetime.now(UTC)
    reply = {"role": "tutor", "content": response.message.strip(), "created_at": now}
    await get_database().study_sets.update_one(
        {"_id": document["_id"]},
        {"$push": {"chat": {"$each": [{"role": "student", "content": message.strip(), "created_at": now}, reply]}}},
    )
    return StudyChatReply(reply=StudySetChatMessage(**reply))


# ---------- Responses ----------


def _summary(document: dict) -> StudySetSummary:
    cards = (document.get("flashcards") or {}).get("cards", [])
    return StudySetSummary(
        id=str(document["_id"]),
        title=document["title"],
        file_name=document["file_name"],
        created_at=document["created_at"],
        tools_ready=[tool for tool in STUDY_TOOLS if document.get(tool)],
        flashcards_known=len(document.get("known_card_ids", [])),
        flashcards_total=len(cards),
        last_quiz=QuizResult(**document["last_quiz"]) if document.get("last_quiz") else None,
    )


def _detail(document: dict) -> StudySetOut:
    return StudySetOut(
        **_summary(document).model_dump(),
        has_file=bool(document.get("file_key")),
        notes=document.get("notes"),
        summary=document.get("summary"),
        flashcards=(document.get("flashcards") or {}).get("cards"),
        known_card_ids=document.get("known_card_ids", []),
        quiz=document.get("quiz"),
        chat=document.get("chat", []),
    )