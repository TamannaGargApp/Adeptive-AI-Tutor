"""Study sets: a learner's own material turned into notes, a summary, flashcards, a quiz and a tutor."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

StudyTool = Literal["notes", "summary", "flashcards", "quiz"]
STUDY_TOOLS: tuple[str, ...] = ("notes", "summary", "flashcards", "quiz")
# All the files in one study set together can be up to 2 GB.
MAX_STUDY_SET_BYTES = 2 * 1024 * 1024 * 1024
MAX_MATERIALS = 20
# Text read from each file (in the browser). Longer files use their beginning.
MAX_TEXT_CHARS = 120_000


# ---------- AI output schemas (no default values: Gemini's schema support is limited) ----------


class StudyNotesResponse(BaseModel):
    content: str


class KeyTerm(BaseModel):
    term: str
    definition: str


class StudySummaryResponse(BaseModel):
    overview: str
    key_points: list[str]
    key_terms: list[KeyTerm]


class FlashcardItem(BaseModel):
    front: str
    back: str


class FlashcardsResponse(BaseModel):
    cards: list[FlashcardItem] = Field(min_length=1)


class StudyQuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_option: int
    explanation: str

    @model_validator(mode="after")
    def valid_choice(self) -> "StudyQuizQuestion":
        if not 2 <= len(self.options) <= 5 or not 0 <= self.correct_option < len(self.options):
            raise ValueError("Each question needs 2-5 options and a valid correct option.")
        return self


class StudyQuizResponse(BaseModel):
    questions: list[StudyQuizQuestion] = Field(min_length=1)


class StudyChatResponse(BaseModel):
    message: str
    on_topic: bool


# ---------- API ----------


class MaterialIn(BaseModel):
    """A file read in the browser: its extracted text, and the size of the original, which is
    uploaded separately (see UploadTarget) so large files never pass through JSON."""

    file_name: str = Field(min_length=1, max_length=200)
    content_type: str = Field(max_length=100)
    file_size: int = Field(ge=1, le=MAX_STUDY_SET_BYTES)
    text: str = Field(min_length=50, max_length=MAX_TEXT_CHARS)


class StudySetCreate(MaterialIn):
    title: str = Field(min_length=1, max_length=120)


class UploadTarget(BaseModel):
    """Where the browser sends the original file with a PUT request.

    direct=True: a presigned AWS S3 link (send exactly these headers, no cookies), then call
    .../complete. direct=False: a path on this API (send it with the login cookie)."""

    material_id: str
    url: str
    method: Literal["PUT"] = "PUT"
    headers: dict[str, str]
    direct: bool


class MaterialOut(BaseModel):
    id: str
    file_name: str
    content_type: str
    size: int
    text_chars: int
    added_at: datetime
    has_file: bool


class Flashcard(FlashcardItem):
    id: str


class StudySetChatMessage(BaseModel):
    role: Literal["student", "tutor"]
    content: str
    created_at: datetime


class QuizResult(BaseModel):
    score: int = Field(ge=0)
    total: int = Field(ge=1)


class StudySetSummary(BaseModel):
    id: str
    title: str
    file_name: str
    material_count: int
    created_at: datetime
    tools_ready: list[str]
    flashcards_known: int
    flashcards_total: int
    last_quiz: QuizResult | None


class StudySetOut(StudySetSummary):
    has_file: bool
    materials: list[MaterialOut]
    storage_used: int
    storage_limit: int
    # Tools made before files were added or removed; they can be regenerated to match.
    stale_tools: list[str]
    notes: StudyNotesResponse | None
    summary: StudySummaryResponse | None
    flashcards: list[Flashcard] | None
    known_card_ids: list[str]
    quiz: StudyQuizResponse | None
    chat: list[StudySetChatMessage]


class StudySetCreated(BaseModel):
    study_set: StudySetSummary
    upload: UploadTarget


class MaterialAdded(BaseModel):
    study_set: StudySetOut
    upload: UploadTarget


class MoreFlashcards(BaseModel):
    study_set: StudySetOut
    new_card_ids: list[str]


class FlashcardProgress(BaseModel):
    known_card_ids: list[str] = Field(max_length=200)


class StudyChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class StudyChatReply(BaseModel):
    reply: StudySetChatMessage