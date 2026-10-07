import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    admin,
    auth,
    feedback,
    final_tests,
    gamification,
    profile,
    progress,
    recommendations,
    sessions,
    study_plans,
    study_sets,
    subjects,
    topics,
    tutor,
)
from app.core.config import get_settings
from app.core.exceptions import AppError
from app.db.indexes import create_indexes
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.db.seed import seed_courses
from app.services import progress_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    await connect_to_mongo(settings.mongodb_uri, settings.database_name)
    await create_indexes()
    await seed_courses()
    await progress_service.backfill_final_test_results()
    logger.info("Connected to MongoDB database '%s'", settings.database_name)
    if not settings.gemini_api_key:
        logger.warning("GEMINI_API_KEY is not set. Tutor features will return an error until it is.")
    yield
    await close_mongo_connection()


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": ".".join(str(part) for part in error["loc"] if part != "body"), "message": error["msg"]}
            for error in exc.errors()
        ]
        first = errors[0] if errors else {"field": "", "message": "Invalid request."}
        detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
        return JSONResponse(status_code=422, content={"detail": detail, "errors": errors})

    # Registered as middleware (inside CORS) rather than an exception handler so that even
    # unexpected 500 responses carry CORS headers and the frontend can read the message.
    @app.middleware("http")
    async def catch_unexpected_errors(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Unhandled error on %s %s", request.method, request.url.path)
            return JSONResponse(
                status_code=500, content={"detail": "Something went wrong on our side. Please try again."}
            )


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Adaptive AI Tutor API",
        version="0.1.0",
        description="Personalized programming tutoring powered by Gemini.",
        lifespan=lifespan,
    )

    register_exception_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    for module in (
        auth, profile, subjects, topics, sessions, tutor, final_tests, progress, recommendations, gamification,
        feedback, admin, study_plans, study_sets,
    ):
        app.include_router(module.router)

    @app.get("/api/health", tags=["health"])
    async def health() -> dict[str, str]:
        await get_database().command("ping")
        return {"status": "ok"}

    return app


app = create_app()