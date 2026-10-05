"""Course notes uploaded by admins, used to ground the tutor in the course's own material.

The notes are the primary source but not the only one: prompts tell the AI to use them for facts,
definitions and terminology, and to add what they lack (examples, simpler explanations) itself.

Admin files are read in the browser; only the extracted text is sent here. It is split into sections,
and for each question the most relevant sections are picked by keyword matching. That is cheap and
works well for a topic's worth of notes; embedding-based search could replace `select_relevant`
later without changing anything else.
"""

import re
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.exceptions import ConflictError, NotFoundError
from app.db.mongodb import get_database, to_object_id
from app.schemas.notes import CourseNotesFile, NotesUpload
from app.services import topic_service

MAX_FILES_PER_TOPIC = 5
CHUNK_TARGET_CHARS = 1200
# How much of the notes goes into one prompt.
EXCERPT_BUDGET_CHARS = 8000
MATERIAL_BUDGET_CHARS = 15000

_STOPWORDS = {
    "the", "and", "for", "are", "but", "not", "you", "your", "with", "this", "that", "from", "what", "how",
    "why", "can", "does", "did", "was", "were", "will", "into", "about", "when", "which", "there", "their",
    "have", "has", "its", "use", "using", "used", "give", "show", "tell", "explain", "please", "example",
}


@dataclass
class NotesExcerpt:
    text: str
    # File names the excerpt came from (shown to admins as source labels).
    sources: list[str]


# ---------- Splitting and matching (pure functions) ----------


def split_into_chunks(text: str) -> list[dict]:
    """Split notes into sections of roughly CHUNK_TARGET_CHARS, keeping each section's heading."""
    chunks: list[dict] = []
    heading = ""
    buffer: list[str] = []

    def flush() -> None:
        body = "\n\n".join(buffer).strip()
        if body:
            chunks.append({"heading": heading, "text": body})
        buffer.clear()

    for paragraph in re.split(r"\n\s*\n", text):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        heading_match = re.match(r"^#{1,6}\s+(.+)", paragraph)
        if heading_match and "\n" not in paragraph:
            flush()
            heading = heading_match.group(1).strip()
            continue
        if sum(len(part) for part in buffer) + len(paragraph) > CHUNK_TARGET_CHARS and buffer:
            flush()
        buffer.append(paragraph)
    flush()
    return chunks


def _terms(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z_][a-z0-9_]{2,}", text.lower()) if word not in _STOPWORDS}


def select_relevant(chunks: list[dict], query: str, budget: int) -> list[dict]:
    """The chunks that best match the query, most relevant first, within a character budget.
    Chunks sharing no words with the query are left out, so unrelated notes aren't included."""
    query_terms = _terms(query)
    scored = []
    for index, chunk in enumerate(chunks):
        words = re.findall(r"[a-z_][a-z0-9_]{2,}", f"{chunk['heading']} {chunk['text']}".lower())
        score = sum(1 for word in words if word in query_terms)
        # Matches in a heading are a strong signal that the section is about the query.
        score += 3 * len(_terms(chunk["heading"]) & query_terms)
        if score > 0:
            scored.append((score, index, chunk))

    selected, used = [], 0
    for _, _, chunk in sorted(scored, key=lambda item: (-item[0], item[1])):
        if used + len(chunk["text"]) > budget:
            continue
        selected.append(chunk)
        used += len(chunk["text"])
    return selected


def format_excerpt(chunks: list[dict]) -> str:
    return "\n\n".join(f"### {chunk['heading']}\n{chunk['text']}" if chunk["heading"] else chunk["text"] for chunk in chunks)


# ---------- Reading notes for prompts ----------


async def _topic_chunks(topic_slug: str) -> list[dict]:
    """All sections of a topic's notes, each tagged with its file name."""
    chunks = []
    async for document in get_database().course_notes.find({"topic_slug": topic_slug}).sort("uploaded_at", 1):
        chunks.extend({**chunk, "source": document["file_name"]} for chunk in document["chunks"])
    return chunks


async def get_excerpt(topic_slug: str, query: str, budget: int = EXCERPT_BUDGET_CHARS) -> NotesExcerpt | None:
    """The parts of a topic's notes relevant to `query`, or None if there are no notes or no match."""
    chunks = await _topic_chunks(topic_slug)
    if not chunks:
        return None
    selected = select_relevant(chunks, query, budget)
    if not selected:
        return None
    sources = list(dict.fromkeys(chunk["source"] for chunk in selected))
    return NotesExcerpt(text=format_excerpt(selected), sources=sources)


async def get_full_notes(topic_slug: str, budget: int = MATERIAL_BUDGET_CHARS) -> NotesExcerpt | None:
    """The topic's notes in their original order (for writing study notes), up to a budget."""
    chunks = await _topic_chunks(topic_slug)
    selected, used = [], 0
    for chunk in chunks:
        if used + len(chunk["text"]) > budget:
            break
        selected.append(chunk)
        used += len(chunk["text"])
    if not selected:
        return None
    return NotesExcerpt(text=format_excerpt(selected), sources=list(dict.fromkeys(c["source"] for c in selected)))


# ---------- Admin management ----------


def _to_out(document: dict) -> CourseNotesFile:
    return CourseNotesFile(
        id=str(document["_id"]),
        topic_slug=document["topic_slug"],
        file_name=document["file_name"],
        characters=document["characters"],
        sections=len(document["chunks"]),
        uploaded_at=document["uploaded_at"],
    )


async def list_notes(topic_slug: str) -> list[CourseNotesFile]:
    cursor = get_database().course_notes.find({"topic_slug": topic_slug}).sort("uploaded_at", 1)
    return [_to_out(document) async for document in cursor]


async def add_notes(topic_slug: str, upload: NotesUpload, uploaded_by: str) -> CourseNotesFile:
    await topic_service.get_topic(topic_slug)
    db = get_database()
    # Uploading a file with the same name replaces it.
    await db.course_notes.delete_many({"topic_slug": topic_slug, "file_name": upload.file_name})
    if await db.course_notes.count_documents({"topic_slug": topic_slug}) >= MAX_FILES_PER_TOPIC:
        raise ConflictError(f"A topic can have up to {MAX_FILES_PER_TOPIC} notes files. Remove one first.")

    document = {
        "topic_slug": topic_slug,
        "file_name": upload.file_name,
        "chunks": split_into_chunks(upload.text),
        "characters": len(upload.text),
        "uploaded_by": uploaded_by,
        "uploaded_at": datetime.now(UTC),
    }
    result = await db.course_notes.insert_one(document)
    document["_id"] = result.inserted_id
    return _to_out(document)


async def delete_notes(notes_id: str) -> None:
    result = await get_database().course_notes.delete_one({"_id": to_object_id(notes_id)})
    if result.deleted_count == 0:
        raise NotFoundError("Notes file not found.")