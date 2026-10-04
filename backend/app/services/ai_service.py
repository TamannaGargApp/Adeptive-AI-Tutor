# """The only module that talks to an LLM provider.

# Services depend on the small `StructuredLLM` protocol, so adding another provider means writing
# one new class with a `generate_structured` method and returning it from `get_ai_service()`.

# Reliability rules, so a busy or slow model never leaves the learner waiting indefinitely:
# - Every Gemini call has a time limit, and so does the whole request.
# - A model that just failed with a "busy" error is skipped for a short cooldown, so later
#   requests go straight to the fallback model instead of waiting on the busy one again.
# """

# import asyncio
# import logging
# import re
# import time
# from typing import Protocol, TypeVar

# from google import genai
# from google.genai import errors as genai_errors
# from google.genai import types
# from pydantic import BaseModel, ValidationError

# from app.core.exceptions import AIServiceError

# logger = logging.getLogger(__name__)

# ResponseModel = TypeVar("ResponseModel", bound=BaseModel)

# CALL_TIMEOUT_SECONDS = 20
# # Kept below the frontend's timeout so the learner always gets a clear message from the backend.
# TOTAL_TIMEOUT_SECONDS = 45
# BUSY_MODEL_COOLDOWN_SECONDS = 60
# RETRY_DELAY_SECONDS = 2.0
# MAX_PARSE_ATTEMPTS = 2

# # 429 = rate limited, 5xx = overloaded. Both usually clear on their own.
# TRANSIENT_STATUS_CODES = {429, 500, 503, 504}
# # The model isn't available for this API key; retrying it won't help.
# MODEL_UNAVAILABLE_CODES = {403, 404}
# TIMEOUT_STATUS = 504

# GENERIC_ERROR = "The AI tutor is unavailable right now. Please try again in a moment."


# class StructuredLLM(Protocol):
#     async def generate_structured(
#         self, *, system_prompt: str, user_prompt: str, response_model: type[ResponseModel]
#     ) -> ResponseModel: ...


# class GeminiAIService:
#     def __init__(self, api_key: str, model: str, fallback_model: str = "") -> None:
#         self._api_key = api_key
#         self._models = [name.strip() for name in (model, fallback_model) if name and name.strip()]
#         self._client: genai.Client | None = None
#         self._cooldown_until: dict[str, float] = {}

#     def _get_client(self) -> genai.Client:
#         if not self._api_key:
#             raise AIServiceError(
#                 "The AI tutor is not configured yet. Add GEMINI_API_KEY to backend/.env and restart the server."
#             )
#         if self._client is None:
#             self._client = genai.Client(api_key=self._api_key)
#         return self._client

#     async def generate_structured(
#         self, *, system_prompt: str, user_prompt: str, response_model: type[ResponseModel]
#     ) -> ResponseModel:
#         config = types.GenerateContentConfig(
#             system_instruction=system_prompt,
#             response_mime_type="application/json",
#             response_schema=response_model,
#             temperature=0.7,
#             # The tutor never uses tools, so automatic function calling only adds overhead and warnings.
#             automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
#         )
#         try:
#             async with asyncio.timeout(TOTAL_TIMEOUT_SECONDS):
#                 return await self._generate_and_parse(user_prompt, config, response_model)
#         except TimeoutError as exc:
#             logger.warning("Gemini request exceeded %ss in total", TOTAL_TIMEOUT_SECONDS)
#             raise AIServiceError(describe_gemini_error(TIMEOUT_STATUS, "")) from exc

#     async def _generate_and_parse(
#         self, user_prompt: str, config: types.GenerateContentConfig, response_model: type[ResponseModel]
#     ) -> ResponseModel:
#         for attempt in range(1, MAX_PARSE_ATTEMPTS + 1):
#             text = await self._generate_text(user_prompt, config)
#             try:
#                 return parse_structured_response(text, response_model)
#             except (ValidationError, ValueError) as exc:
#                 logger.warning("Malformed %s from Gemini (attempt %d): %s", response_model.__name__, attempt, exc)
#         raise AIServiceError("The AI tutor gave an unexpected response. Please try again.")

#     def _models_to_try(self) -> list[str]:
#         now = time.monotonic()
#         ready = [model for model in self._models if self._cooldown_until.get(model, 0) <= now]
#         # If every model is cooling down, try them anyway rather than failing without asking.
#         return ready or list(self._models)

#     async def _generate_text(self, user_prompt: str, config: types.GenerateContentConfig) -> str | None:
#         """Try each available model once; the last one gets one retry, since there's nothing after it."""
#         client = self._get_client()
#         models = self._models_to_try()
#         last_code: int | None = None

#         for index, model in enumerate(models):
#             attempts = 2 if index == len(models) - 1 else 1
#             for attempt in range(attempts):
#                 if attempt > 0:
#                     await asyncio.sleep(RETRY_DELAY_SECONDS)
#                 try:
#                     async with asyncio.timeout(CALL_TIMEOUT_SECONDS):
#                         response = await client.aio.models.generate_content(
#                             model=model, contents=user_prompt, config=config
#                         )
#                     self._cooldown_until.pop(model, None)
#                     return response.text
#                 except TimeoutError:
#                     last_code = TIMEOUT_STATUS
#                     logger.warning("Gemini model %s did not answer within %ss", model, CALL_TIMEOUT_SECONDS)
#                     self._start_cooldown(model)
#                 except genai_errors.APIError as exc:
#                     last_code = exc.code
#                     logger.warning("Gemini error %s on model %s: %s", exc.code, model, exc.message)
#                     if exc.code in MODEL_UNAVAILABLE_CODES:
#                         self._start_cooldown(model)
#                         break
#                     if exc.code not in TRANSIENT_STATUS_CODES:
#                         raise AIServiceError(describe_gemini_error(exc.code, model)) from exc
#                     self._start_cooldown(model)
#                 except Exception as exc:
#                     logger.exception("Gemini request failed")
#                     raise AIServiceError(GENERIC_ERROR) from exc

#         raise AIServiceError(describe_gemini_error(last_code, ", ".join(models)))

#     def _start_cooldown(self, model: str) -> None:
#         if len(self._models) > 1:
#             self._cooldown_until[model] = time.monotonic() + BUSY_MODEL_COOLDOWN_SECONDS
#             logger.info("Skipping model %s for %ss", model, BUSY_MODEL_COOLDOWN_SECONDS)


# def describe_gemini_error(status_code: int | None, model: str) -> str:
#     if status_code == 400:
#         return "The Gemini API key or request was rejected. Check GEMINI_API_KEY in backend/.env."
#     if status_code in MODEL_UNAVAILABLE_CODES:
#         return f"The Gemini model '{model}' isn't available for this API key. Set GEMINI_MODEL in backend/.env."
#     if status_code == 429:
#         return "The AI tutor has hit its usage limit. Please wait a minute and try again."
#     if status_code == TIMEOUT_STATUS:
#         return "The AI tutor took too long to answer. Please try again."
#     if status_code in TRANSIENT_STATUS_CODES:
#         return "The AI tutor is very busy right now. Please try again in a minute."
#     return GENERIC_ERROR


# def parse_structured_response(text: str | None, response_model: type[ResponseModel]) -> ResponseModel:
#     if not text or not text.strip():
#         raise ValueError("Empty response")
#     # Strip Markdown code fences in case the model wraps its JSON anyway.
#     cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
#     return response_model.model_validate_json(cleaned)
















"""The only module that talks to an LLM provider.

Services depend on the small `StructuredLLM` protocol, so adding another provider means writing
one new class with a `generate_structured` method and returning it from `get_ai_service()`.

Reliability rules, so a busy or slow model never leaves the learner waiting indefinitely:
- Every Gemini call has a time limit, and so does the whole request.
- A model that just failed with a "busy" error is skipped for a short cooldown, so later
  requests go straight to the fallback model instead of waiting on the busy one again.
"""

import asyncio
import logging
import re
import time
from typing import Protocol, TypeVar

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.core.exceptions import AIServiceError

logger = logging.getLogger(__name__)

ResponseModel = TypeVar("ResponseModel", bound=BaseModel)

# Long outputs (study notes, course exams) can take a while to generate.
CALL_TIMEOUT_SECONDS = 30
# Kept below the frontend's timeout so the learner always gets a clear message from the backend.
TOTAL_TIMEOUT_SECONDS = 55
BUSY_MODEL_COOLDOWN_SECONDS = 60
RETRY_DELAY_SECONDS = 2.0
MAX_PARSE_ATTEMPTS = 2

# 429 = rate limited, 5xx = overloaded. Both usually clear on their own.
TRANSIENT_STATUS_CODES = {429, 500, 503, 504}
# The model isn't available for this API key; retrying it won't help.
MODEL_UNAVAILABLE_CODES = {403, 404}
TIMEOUT_STATUS = 504

GENERIC_ERROR = "The AI tutor is unavailable right now. Please try again in a moment."


class StructuredLLM(Protocol):
    async def generate_structured(
        self, *, system_prompt: str, user_prompt: str, response_model: type[ResponseModel]
    ) -> ResponseModel: ...


class GeminiAIService:
    def __init__(self, api_key: str, model: str, fallback_model: str = "") -> None:
        self._api_key = api_key
        self._models = [name.strip() for name in (model, fallback_model) if name and name.strip()]
        self._client: genai.Client | None = None
        self._cooldown_until: dict[str, float] = {}

    def _get_client(self) -> genai.Client:
        if not self._api_key:
            raise AIServiceError(
                "The AI tutor is not configured yet. Add GEMINI_API_KEY to backend/.env and restart the server."
            )
        if self._client is None:
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    async def generate_structured(
        self, *, system_prompt: str, user_prompt: str, response_model: type[ResponseModel]
    ) -> ResponseModel:
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
            response_schema=response_model,
            temperature=0.7,
            # The tutor never uses tools, so automatic function calling only adds overhead and warnings.
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        try:
            async with asyncio.timeout(TOTAL_TIMEOUT_SECONDS):
                return await self._generate_and_parse(user_prompt, config, response_model)
        except TimeoutError as exc:
            logger.warning("Gemini request exceeded %ss in total", TOTAL_TIMEOUT_SECONDS)
            raise AIServiceError(describe_gemini_error(TIMEOUT_STATUS, "")) from exc

    async def _generate_and_parse(
        self, user_prompt: str, config: types.GenerateContentConfig, response_model: type[ResponseModel]
    ) -> ResponseModel:
        for attempt in range(1, MAX_PARSE_ATTEMPTS + 1):
            text = await self._generate_text(user_prompt, config)
            try:
                return parse_structured_response(text, response_model)
            except (ValidationError, ValueError) as exc:
                logger.warning("Malformed %s from Gemini (attempt %d): %s", response_model.__name__, attempt, exc)
        raise AIServiceError("The AI tutor gave an unexpected response. Please try again.")

    def _models_to_try(self) -> list[str]:
        now = time.monotonic()
        ready = [model for model in self._models if self._cooldown_until.get(model, 0) <= now]
        # If every model is cooling down, try them anyway rather than failing without asking.
        return ready or list(self._models)

    async def _generate_text(self, user_prompt: str, config: types.GenerateContentConfig) -> str | None:
        """Try each available model once; the last one gets one retry, since there's nothing after it."""
        client = self._get_client()
        models = self._models_to_try()
        last_code: int | None = None

        for index, model in enumerate(models):
            attempts = 2 if index == len(models) - 1 else 1
            for attempt in range(attempts):
                if attempt > 0:
                    await asyncio.sleep(RETRY_DELAY_SECONDS)
                try:
                    async with asyncio.timeout(CALL_TIMEOUT_SECONDS):
                        response = await client.aio.models.generate_content(
                            model=model, contents=user_prompt, config=config
                        )
                    self._cooldown_until.pop(model, None)
                    return response.text
                except TimeoutError:
                    last_code = TIMEOUT_STATUS
                    logger.warning("Gemini model %s did not answer within %ss", model, CALL_TIMEOUT_SECONDS)
                    self._start_cooldown(model)
                except genai_errors.APIError as exc:
                    last_code = exc.code
                    logger.warning("Gemini error %s on model %s: %s", exc.code, model, exc.message)
                    if exc.code in MODEL_UNAVAILABLE_CODES:
                        self._start_cooldown(model)
                        break
                    if exc.code not in TRANSIENT_STATUS_CODES:
                        raise AIServiceError(describe_gemini_error(exc.code, model)) from exc
                    self._start_cooldown(model)
                except Exception as exc:
                    logger.exception("Gemini request failed")
                    raise AIServiceError(GENERIC_ERROR) from exc

        raise AIServiceError(describe_gemini_error(last_code, ", ".join(models)))

    def _start_cooldown(self, model: str) -> None:
        if len(self._models) > 1:
            self._cooldown_until[model] = time.monotonic() + BUSY_MODEL_COOLDOWN_SECONDS
            logger.info("Skipping model %s for %ss", model, BUSY_MODEL_COOLDOWN_SECONDS)


def describe_gemini_error(status_code: int | None, model: str) -> str:
    if status_code == 400:
        return "The Gemini API key or request was rejected. Check GEMINI_API_KEY in backend/.env."
    if status_code in MODEL_UNAVAILABLE_CODES:
        return f"The Gemini model '{model}' isn't available for this API key. Set GEMINI_MODEL in backend/.env."
    if status_code == 429:
        return "The AI tutor has hit its usage limit. Please wait a minute and try again."
    if status_code == TIMEOUT_STATUS:
        return "The AI tutor took too long to answer. Please try again."
    if status_code in TRANSIENT_STATUS_CODES:
        return "The AI tutor is very busy right now. Please try again in a minute."
    return GENERIC_ERROR


def parse_structured_response(text: str | None, response_model: type[ResponseModel]) -> ResponseModel:
    if not text or not text.strip():
        raise ValueError("Empty response")
    # Strip Markdown code fences in case the model wraps its JSON anyway.
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return response_model.model_validate_json(cleaned)