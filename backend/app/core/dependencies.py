from typing import Annotated

from fastapi import Depends, Request

from app.core.config import get_settings
from app.core.exceptions import AuthenticationError, ForbiddenError
from app.core.security import AUTH_COOKIE_NAME, decode_access_token
from app.models.user import User
from app.services import user_service
from app.services.ai_service import GeminiAIService, StructuredLLM


def _read_token(request: Request) -> str | None:
    # The browser app authenticates with an httpOnly cookie; API clients may send a Bearer header.
    cookie_token = request.cookies.get(AUTH_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("Authorization", "")
    scheme, _, token = auth_header.partition(" ")
    if scheme.lower() == "bearer" and token:
        return token
    return None


async def get_current_user(request: Request) -> User:
    token = _read_token(request)
    if token is None:
        raise AuthenticationError("Please log in to continue.")

    user_id = decode_access_token(token)
    if user_id is None:
        raise AuthenticationError("Your session has expired. Please log in again.")

    user = await user_service.get_user_by_id(user_id)
    if user is None:
        raise AuthenticationError("Your session has expired. Please log in again.")
    return user


def is_admin(user: User) -> bool:
    return user.email.lower() in get_settings().admin_email_set


async def get_admin_user(request: Request) -> User:
    user = await get_current_user(request)
    if not is_admin(user):
        raise ForbiddenError("This area is for administrators only.")
    return user


_ai_service: GeminiAIService | None = None


def get_ai_service() -> StructuredLLM:
    """Single shared AI client. Override this dependency in tests to avoid real Gemini calls."""
    global _ai_service
    if _ai_service is None:
        settings = get_settings()
        _ai_service = GeminiAIService(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
            fallback_model=settings.gemini_fallback_model,
        )
    return _ai_service


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(get_admin_user)]
AIDependency = Annotated[StructuredLLM, Depends(get_ai_service)]