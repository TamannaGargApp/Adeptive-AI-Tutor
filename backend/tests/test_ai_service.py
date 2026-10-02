"""Retry, fallback, cooldown and timeout behaviour of the Gemini service, with a fake client."""

import asyncio
from types import SimpleNamespace

import pytest
from google.genai import errors as genai_errors
from pydantic import BaseModel

from app.core.exceptions import AIServiceError
from app.services import ai_service
from app.services.ai_service import GeminiAIService


class Answer(BaseModel):
    text: str


VALID_JSON = '{"text": "hello"}'


def busy_error() -> genai_errors.APIError:
    return genai_errors.ServerError(
        503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}}
    )


class FakeModels:
    def __init__(self, outcomes: dict[str, object]) -> None:
        self.outcomes = outcomes
        self.calls: list[str] = []

    async def generate_content(self, *, model: str, contents: str, config: object) -> SimpleNamespace:
        self.calls.append(model)
        outcome = self.outcomes[model]
        if outcome == "hang":
            await asyncio.sleep(10)
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(text=outcome)


def make_service(outcomes: dict[str, object]) -> tuple[GeminiAIService, FakeModels]:
    service = GeminiAIService(api_key="test-key", model="main", fallback_model="backup")
    fake = FakeModels(outcomes)
    service._client = SimpleNamespace(aio=SimpleNamespace(models=fake))  # type: ignore[assignment]
    return service, fake


@pytest.fixture(autouse=True)
def fast_timings(monkeypatch):
    monkeypatch.setattr(ai_service, "RETRY_DELAY_SECONDS", 0)
    monkeypatch.setattr(ai_service, "CALL_TIMEOUT_SECONDS", 0.05)


async def generate(service: GeminiAIService) -> Answer:
    return await service.generate_structured(system_prompt="s", user_prompt="u", response_model=Answer)


async def test_busy_model_falls_back_and_is_skipped_afterwards():
    service, fake = make_service({"main": busy_error(), "backup": VALID_JSON})

    assert (await generate(service)).text == "hello"
    assert (await generate(service)).text == "hello"

    # The second request goes straight to the backup instead of waiting on the busy model again.
    assert fake.calls == ["main", "backup", "backup"]


async def test_slow_model_times_out_and_falls_back():
    service, fake = make_service({"main": "hang", "backup": VALID_JSON})

    assert (await generate(service)).text == "hello"
    assert fake.calls == ["main", "backup"]


async def test_clear_error_when_every_model_is_busy():
    service, fake = make_service({"main": busy_error(), "backup": busy_error()})

    with pytest.raises(AIServiceError, match="very busy"):
        await generate(service)
    assert fake.calls == ["main", "backup", "backup"]


async def test_rejected_api_key_fails_immediately():
    bad_key = genai_errors.ClientError(400, {"error": {"code": 400, "message": "API key not valid"}})
    service, fake = make_service({"main": bad_key, "backup": VALID_JSON})

    with pytest.raises(AIServiceError, match="API key"):
        await generate(service)
    assert fake.calls == ["main"]