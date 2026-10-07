"""Study sets: a learner's own material turned into notes, a summary, flashcards, a quiz and a tutor."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

StudyTool = Literal["notes", "summary", "flashcards", "quiz"]
STUDY_TOOLS: tuple[str, ...] = ("notes", "summary", "flashcards", "quiz")
MAX_FILE_BYTES = 10 * 1024 * 1024
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


class StudySetCreate(BaseModel):
    """A file read in the browser: its extracted text, plus the original file (base64) for storage."""

    title: str = Field(min_length=1, max_length=120)
    file_name: str = Field(min_length=1, max_length=200)
    content_type: str = Field(max_length=100)
    text: str = Field(min_length=50, max_length=MAX_TEXT_CHARS)
    file_base64: str | None = Field(default=None, max_length=MAX_FILE_BYTES * 4 // 3 + 4)


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
    created_at: datetime
    tools_ready: list[str]
    flashcards_known: int
    flashcards_total: int
    last_quiz: QuizResult | None


class StudySetOut(StudySetSummary):
    has_file: bool
    notes: StudyNotesResponse | None
    summary: StudySummaryResponse | None
    flashcards: list[Flashcard] | None
    known_card_ids: list[str]
    quiz: StudyQuizResponse | None
    chat: list[StudySetChatMessage]


class MoreFlashcards(BaseModel):
    study_set: StudySetOut
    new_card_ids: list[str]


class FlashcardProgress(BaseModel):
    known_card_ids: list[str] = Field(max_length=200)


class StudyChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class StudyChatReply(BaseModel):
    reply: StudySetChatMessage