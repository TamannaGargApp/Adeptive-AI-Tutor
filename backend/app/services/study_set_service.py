"""Study sets: a learner's material turned into notes, a summary, flashcards, a quiz and a tutor.

A set holds one or more files ("materials"). Each file's extracted text and its original go to file
storage (AWS S3, or a local folder in development); all of a set's files together can be up to
2 GB. Originals are uploaded separately from the text: straight to S3 with a presigned link, or
streamed to disk through the API with local storage, so large files never sit in memory.

The generated study aids, flashcard progress, quiz results and tutor chat are kept in MongoDB.
Each tool is generated the first time it's opened, then saved. When files are added or removed,
existing tools are marked stale so the learner can update them.
"""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

from bson import ObjectId

from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.db.mongodb import get_database, to_object_id
from app.models.user import User
from app.prompts.study_set_prompt import STUDY_SET_SYSTEM_PROMPT, build_study_chat_prompt, build_tool_prompt
from app.schemas.study_set import (
    MAX_MATERIALS,
    MAX_STUDY_SET_BYTES,
    STUDY_TOOLS,
    FlashcardsResponse,
    MaterialAdded,
    MaterialIn,
    MaterialOut,
    QuizResult,
    StudyChatReply,
    StudyChatResponse,
    StudyNotesResponse,
    StudyQuizResponse,
    StudySetChatMessage,
    StudySetCreate,
    StudySetCreated,
    StudySetOut,
    StudySetSummary,
    StudySummaryResponse,
    UploadTarget,
)
from app.services.ai_service import StructuredLLM
from app.services.file_storage import FileTooLargeError, get_file_storage

MAX_STUDY_SETS = 20
# How much of the material goes into one prompt, shared fairly between a set's files.
MATERIAL_PROMPT_CHARS = 60_000
CHAT_HISTORY_LIMIT = 12
MAX_FLASHCARDS = 120
ALLOWED_CONTENT_TYPES = {"application/pdf", "text/plain", "text/markdown", "text/x-markdown", ""}
LEGACY_MATERIAL_ID = "original"

TOOL_MODELS = {
    "notes": StudyNotesResponse,
    "summary": StudySummaryResponse,
    "flashcards": FlashcardsResponse,
    "quiz": StudyQuizResponse,
}


def _material_keys(user_id: str, set_id: str, material_id: str) -> tuple[str, str]:
    folder = f"users/{user_id}/study-sets/{set_id}/materials/{material_id}"
    return f"{folder}/original", f"{folder}/text.txt"


async def _get_document(user: User, set_id: str) -> dict:
    object_id = to_object_id(set_id)
    document = None
    if object_id is not None:
        document = await get_database().study_sets.find_one({"_id": object_id, "user_id": user.id})
    if document is None:
        raise NotFoundError("Study set not found.")
    return document


def _materials(document: dict) -> list[dict]:
    """The set's files. Sets made before multi-file support kept one file's details on the set
    itself; they're presented as a single material."""
    if "materials" in document:
        return document["materials"]
    return [
        {
            "id": LEGACY_MATERIAL_ID,
            "file_name": document["file_name"],
            "content_type": document.get("content_type", ""),
            "size": document.get("file_size", 0),
            "text_key": document["text_key"],
            "file_key": document.get("file_key"),
            "text_chars": document.get("text_chars", 0),
            "added_at": document["created_at"],
            "has_file": bool(document.get("file_key")),
        }
    ]


async def _ensure_materials(document: dict) -> dict:
    """Move an older single-file set to the materials list, so files can be added to it."""
    if "materials" in document:
        return document
    materials = _materials(document)
    await get_database().study_sets.update_one(
        {"_id": document["_id"], "materials": {"$exists": False}}, {"$set": {"materials": materials}}
    )
    return {**document, "materials": materials}


def _find_material(document: dict, material_id: str) -> dict:
    for material in _materials(document):
        if material["id"] == material_id:
            return material
    raise NotFoundError("File not found in this study set.")


def _storage_used(document: dict) -> int:
    return sum(material.get("size", 0) for material in _materials(document))


def _share(lengths: list[int], budget: int) -> list[int]:
    """Split a character budget fairly: short files are used in full and the rest is shared."""
    allotted = [0] * len(lengths)
    remaining = budget
    order = sorted(range(len(lengths)), key=lambda index: lengths[index])
    for position, index in enumerate(order):
        allotted[index] = min(lengths[index], remaining // (len(order) - position))
        remaining -= allotted[index]
    return allotted


async def _material(document: dict) -> str:
    """The text the AI works from. With several files, each is labelled with its file name."""
    storage = get_file_storage()
    materials = _materials(document)
    texts = [(await storage.load(material["text_key"])).decode("utf-8") for material in materials]
    if len(texts) == 1:
        return texts[0][:MATERIAL_PROMPT_CHARS]
    headers = [f"### Source {number}: {material['file_name']}\n" for number, material in enumerate(materials, 1)]
    budget = MATERIAL_PROMPT_CHARS - sum(len(header) + 2 for header in headers)
    allotted = _share([len(text) for text in texts], budget)
    return "\n\n".join(header + text[:size] for header, text, size in zip(headers, texts, allotted, strict=True))


def _validate_material(data: MaterialIn, used: int) -> None:
    if data.content_type not in ALLOWED_CONTENT_TYPES:
        raise AppError("Study sets can be made from PDF, text or Markdown files.")
    if used + data.file_size > MAX_STUDY_SET_BYTES:
        left = max(0, MAX_STUDY_SET_BYTES - used)
        raise FileTooLargeError(
            f"A study set's files can add up to 2 GB. This one has {_format_size(left)} left; "
            f"{data.file_name} is {_format_size(data.file_size)}."
        )


def _format_size(size: int) -> str:
    for unit in ("bytes", "KB", "MB"):
        if size < 1024:
            return f"{size:.0f} {unit}" if unit == "bytes" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.2f} GB"


async def _new_material(user: User, set_id: str, data: MaterialIn) -> dict:
    """Save a file's text and describe the material. The original is uploaded afterwards."""
    material_id = uuid.uuid4().hex
    file_key, text_key = _material_keys(user.id, set_id, material_id)
    await get_file_storage().save(text_key, data.text.encode("utf-8"), "text/plain; charset=utf-8")
    return {
        "id": material_id,
        "file_name": data.file_name,
        "content_type": data.content_type,
        "size": data.file_size,
        "text_key": text_key,
        "file_key": file_key,
        "text_chars": len(data.text),
        "added_at": datetime.now(UTC),
        "has_file": False,
    }


async def _upload_target(set_id: str, material: dict) -> UploadTarget:
    content_type = material["content_type"] or "application/octet-stream"
    direct = await get_file_storage().upload_url(material["file_key"], content_type)
    if direct:
        url, headers = direct
        return UploadTarget(material_id=material["id"], url=url, headers=headers, direct=True)
    return UploadTarget(
        material_id=material["id"],
        url=f"/api/study-sets/{set_id}/materials/{material['id']}/file",
        headers={"Content-Type": "application/octet-stream"},
        direct=False,
    )


def _stale_after_change(document: dict) -> list[str]:
    """Tools generated so far no longer match the files."""
    return [tool for tool in STUDY_TOOLS if document.get(tool)]


# ---------- Creating, listing, deleting ----------


async def create_study_set(user: User, data: StudySetCreate) -> StudySetCreated:
    db = get_database()
    if await db.study_sets.count_documents({"user_id": user.id}) >= MAX_STUDY_SETS:
        raise ConflictError(f"You can have up to {MAX_STUDY_SETS} study sets. Delete one to add another.")
    _validate_material(data, 0)

    set_id = ObjectId()
    material = await _new_material(user, str(set_id), data)
    document = {
        "_id": set_id,
        "user_id": user.id,
        "title": data.title.strip(),
        "file_name": data.file_name,
        "materials": [material],
        "created_at": datetime.now(UTC),
        "known_card_ids": [],
        "chat": [],
        "stale_tools": [],
    }
    await db.study_sets.insert_one(document)
    return StudySetCreated(study_set=_summary(document), upload=await _upload_target(str(set_id), material))


async def add_material(user: User, set_id: str, data: MaterialIn) -> MaterialAdded:
    document = await _ensure_materials(await _get_document(user, set_id))
    if len(document["materials"]) >= MAX_MATERIALS:
        raise ConflictError(f"A study set can have up to {MAX_MATERIALS} files.")
    _validate_material(data, _storage_used(document))

    material = await _new_material(user, set_id, data)
    stale = _stale_after_change(document)
    await get_database().study_sets.update_one(
        {"_id": document["_id"]}, {"$push": {"materials": material}, "$set": {"stale_tools": stale}}
    )
    updated = {**document, "materials": [*document["materials"], material], "stale_tools": stale}
    return MaterialAdded(study_set=_detail(updated), upload=await _upload_target(set_id, material))


async def receive_material_file(
    user: User, set_id: str, material_id: str, chunks: AsyncIterator[bytes]
) -> StudySetOut:
    """Local storage: the original file, streamed to disk as it arrives."""
    document = await _get_document(user, set_id)
    material = _uploadable(document, material_id)
    storage = get_file_storage()
    if not hasattr(storage, "save_stream"):
        raise AppError("Files are uploaded straight to cloud storage on this server.")
    if material["has_file"]:
        raise ConflictError("This file has already been uploaded.")
    size = await storage.save_stream(material["file_key"], chunks, material["size"])
    return await _mark_uploaded(document, material_id, size)


async def complete_material_upload(user: User, set_id: str, material_id: str) -> StudySetOut:
    """S3: check the file the browser uploaded with its presigned link, then mark it saved."""
    document = await _get_document(user, set_id)
    material = _uploadable(document, material_id)
    if material["has_file"]:
        return _detail(document)
    storage = get_file_storage()
    size = await storage.size(material["file_key"])
    if size is None:
        raise NotFoundError("The file hasn't finished uploading. Please try again.")
    if size > material["size"]:
        # Bigger than declared, which would get round the 2 GB limit: refuse it.
        await storage.delete(material["file_key"])
        raise FileTooLargeError("The uploaded file is larger than expected, so it wasn't kept.")
    return await _mark_uploaded(document, material_id, size)


def _uploadable(document: dict, material_id: str) -> dict:
    """A file added with an upload link (older single-file sets have none)."""
    material = _find_material(document, material_id)
    if "materials" not in document or not material.get("file_key"):
        raise ConflictError("This file can't be uploaded again.")
    return material


async def _mark_uploaded(document: dict, material_id: str, size: int) -> StudySetOut:
    await get_database().study_sets.update_one(
        {"_id": document["_id"], "materials.id": material_id},
        {"$set": {"materials.$.has_file": True, "materials.$.size": size}},
    )
    materials = [
        {**material, "has_file": True, "size": size} if material["id"] == material_id else material
        for material in document["materials"]
    ]
    return _detail({**document, "materials": materials})


async def remove_material(user: User, set_id: str, material_id: str) -> StudySetOut:
    document = await _ensure_materials(await _get_document(user, set_id))
    material = _find_material(document, material_id)
    if len(document["materials"]) == 1:
        raise ConflictError("A study set needs at least one file. Delete the whole set instead.")

    storage = get_file_storage()
    for key in (material.get("file_key"), material["text_key"]):
        if key:
            await storage.delete(key)
    materials = [item for item in document["materials"] if item["id"] != material_id]
    changes = {"file_name": materials[0]["file_name"], "stale_tools": _stale_after_change(document)}
    await get_database().study_sets.update_one(
        {"_id": document["_id"]}, {"$pull": {"materials": {"id": material_id}}, "$set": changes}
    )
    return _detail({**document, **changes, "materials": materials})


async def list_study_sets(user: User) -> list[StudySetSummary]:
    cursor = get_database().study_sets.find({"user_id": user.id}).sort("created_at", -1)
    return [_summary(document) async for document in cursor]


async def get_study_set(user: User, set_id: str) -> StudySetOut:
    return _detail(await _get_document(user, set_id))


async def delete_study_set(user: User, set_id: str) -> None:
    document = await _get_document(user, set_id)
    storage = get_file_storage()
    for material in _materials(document):
        for key in (material.get("file_key"), material["text_key"]):
            if key:
                await storage.delete(key)
    await get_database().study_sets.delete_one({"_id": document["_id"]})


async def download_link(user: User, set_id: str, material_id: str | None) -> tuple[str | None, Path | None, dict]:
    """A presigned S3 link, or (with local storage) the file on disk to stream."""
    document = await _get_document(user, set_id)
    if material_id:
        material = _find_material(document, material_id)
    else:
        material = next((item for item in _materials(document) if item["has_file"]), None)
    if not material or not material["has_file"]:
        raise NotFoundError("The original file wasn't saved for this study set.")
    storage = get_file_storage()
    url = await storage.download_url(material["file_key"], material["file_name"])
    path = None if url else storage.local_path(material["file_key"])
    if not url and path is None:
        raise NotFoundError("The original file is missing from storage.")
    return url, path, material


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
    # A freshly generated tool matches the current files.
    changes: dict = {tool: value, "stale_tools": [item for item in document.get("stale_tools", []) if item != tool]}
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
    # New cards are made from all the current files, so the deck is up to date again.
    stale = [item for item in document.get("stale_tools", []) if item != "flashcards"]
    changes = {"flashcards": flashcards, "stale_tools": stale}
    await get_database().study_sets.update_one({"_id": document["_id"]}, {"$set": changes})
    return _detail({**document, **changes}), [card["id"] for card in new_cards]


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
        material_count=len(_materials(document)),
        created_at=document["created_at"],
        tools_ready=[tool for tool in STUDY_TOOLS if document.get(tool)],
        flashcards_known=len(document.get("known_card_ids", [])),
        flashcards_total=len(cards),
        last_quiz=QuizResult(**document["last_quiz"]) if document.get("last_quiz") else None,
    )


def _detail(document: dict) -> StudySetOut:
    materials = _materials(document)
    return StudySetOut(
        **_summary(document).model_dump(),
        has_file=any(material["has_file"] for material in materials),
        materials=[
            MaterialOut(**{key: material[key] for key in MaterialOut.model_fields}) for material in materials
        ],
        storage_used=_storage_used(document),
        storage_limit=MAX_STUDY_SET_BYTES,
        stale_tools=document.get("stale_tools", []),
        notes=document.get("notes"),
        summary=document.get("summary"),
        flashcards=(document.get("flashcards") or {}).get("cards"),
        known_card_ids=document.get("known_card_ids", []),
        quiz=document.get("quiz"),
        chat=document.get("chat", []),
    )