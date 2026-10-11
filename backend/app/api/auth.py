from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.core.dependencies import CurrentUser
from app.core.security import AUTH_COOKIE_NAME, create_access_token
from app.schemas.auth import LoginRequest, MessageResponse, RegisterRequest
from app.schemas.user import UserPublic
from app.services import user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_auth_cookie(response: Response, user_id: str) -> None:
    # httpOnly keeps the token away from JavaScript, which protects it from XSS.
    settings = get_settings()
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=create_access_token(user_id),
        httponly=True,
        secure=settings.cookie_secure,
        # samesite="lax",
        samesite="none",
        max_age=settings.jwt_access_token_expire_minutes * 60,
        path="/",
    )


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, response: Response) -> UserPublic:
    user = await user_service.create_user(data.name, data.email, data.password)
    _set_auth_cookie(response, user.id)
    return UserPublic.from_user(user)


@router.post("/login", response_model=UserPublic)
async def login(data: LoginRequest, response: Response) -> UserPublic:
    user = await user_service.authenticate_user(data.email, data.password)
    _set_auth_cookie(response, user.id)
    return UserPublic.from_user(user)


@router.post("/logout", response_model=MessageResponse)
async def logout(response: Response) -> MessageResponse:
    response.delete_cookie(AUTH_COOKIE_NAME, path="/")
    return MessageResponse(message="Logged out.")


@router.get("/me", response_model=UserPublic)
async def read_current_user(user: CurrentUser) -> UserPublic:
    return UserPublic.from_user(user)
