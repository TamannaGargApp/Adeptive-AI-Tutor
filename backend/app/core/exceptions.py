"""Domain exceptions raised by services and translated to HTTP responses in main.py.

Services raise these instead of HTTPException so business logic stays independent of FastAPI.
"""


class AppError(Exception):
    status_code = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class AuthenticationError(AppError):
    status_code = 401


class AIServiceError(AppError):
    status_code = 503
