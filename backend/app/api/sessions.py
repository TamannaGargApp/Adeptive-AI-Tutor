from fastapi import APIRouter, status

from app.core.dependencies import CurrentUser
from app.schemas.session import SessionCreate, SessionOut, SessionSummary
from app.services import session_service

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(data: SessionCreate, user: CurrentUser) -> SessionOut:
    session = await session_service.create_session(user, data)
    return SessionOut.from_session(session)


@router.get("", response_model=list[SessionSummary])
async def list_learn_sessions(topic_slug: str, user: CurrentUser) -> list[SessionSummary]:
    """Learn conversation history for one topic, newest first."""
    return await session_service.list_learn_sessions(user.id, topic_slug)


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: str, user: CurrentUser) -> SessionOut:
    session = await session_service.get_session(user.id, session_id)
    return SessionOut.from_session(session)