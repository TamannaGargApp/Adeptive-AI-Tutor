import os

# Configure the app for tests *before* importing it. Real environment values in .env
# are overridden so tests never touch the development database or call Gemini.
os.environ["JWT_SECRET_KEY"] = "test-secret-key-that-is-definitely-long-enough"
os.environ["DATABASE_NAME"] = "ai_tutor_test"
os.environ["GEMINI_API_KEY"] = ""

from collections.abc import AsyncIterator  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.dependencies import get_ai_service  # noqa: E402
from app.core.exceptions import AIServiceError  # noqa: E402
from app.db.indexes import create_indexes  # noqa: E402
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_database  # noqa: E402
from app.db.seed import seed_courses  # noqa: E402
from app.main import app  # noqa: E402

TEST_PASSWORD = "correct-horse-battery"


class FakeAI:
    """Stands in for Gemini. Tests set the response returned for each response model."""

    def __init__(self) -> None:
        self.responses: dict[type[BaseModel], BaseModel] = {}
        self.calls: list[str] = []
        self.prompts: list[str] = []

    async def generate_structured(self, *, system_prompt: str, user_prompt: str, response_model):
        self.calls.append(response_model.__name__)
        self.prompts.append(user_prompt)
        if response_model not in self.responses:
            raise AIServiceError("Fake AI has no response configured.")
        return self.responses[response_model]


@pytest_asyncio.fixture
async def database():
    settings = get_settings()
    try:
        await connect_to_mongo(settings.mongodb_uri, settings.database_name)
    except Exception:
        pytest.skip(f"MongoDB is not reachable at {settings.mongodb_uri}")

    db = get_database()
    await db.client.drop_database(settings.database_name)
    await create_indexes()
    await seed_courses()
    yield db
    await db.client.drop_database(settings.database_name)
    await close_mongo_connection()


@pytest.fixture
def fake_ai() -> FakeAI:
    return FakeAI()


@pytest_asyncio.fixture
async def client(database, fake_ai: FakeAI) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_ai_service] = lambda: fake_ai
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http_client:
        yield http_client
    app.dependency_overrides.clear()


async def register(client: AsyncClient, email: str = "ada@example.com", name: str = "Ada"):
    return await client.post(
        "/api/auth/register", json={"name": name, "email": email, "password": TEST_PASSWORD}
    )


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    """A client that is registered, logged in (cookie stored) and onboarded."""
    response = await register(client)
    assert response.status_code == 201
    profile = await client.put(
        "/api/profile",
        json={"name": "Ada", "level": "beginner", "goal": "learn_python", "preferred_difficulty": "beginner"},
    )
    assert profile.status_code == 200
    return client