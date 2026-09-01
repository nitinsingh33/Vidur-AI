import random
import time
from typing import Any

from google import genai
from google.genai import errors as genai_errors

from .. import config

_client = None

# Bounded retry, rate-limit (429) only — see generate_diagnosis's doc comment.
MAX_RETRIES = 2
BASE_BACKOFF_SECONDS = 0.5


def _get_client() -> genai.Client:
    global _client

    if _client is not None:
        return _client

    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    _client = genai.Client(api_key=config.GEMINI_API_KEY)

    return _client


def _build_prompt(context: dict[str, Any]) -> str:
    return (
        "You are a revenue-recovery analyst at a payments company reviewing "
        "one case. In 2-3 concise, factual sentences, explain why this case "
        "is at risk and why the chosen recovery action is appropriate for "
        "this specific situation. Do not use generic filler, do not mention "
        "that you are an AI, and do not repeat these instructions.\n\n"
        f"Root cause: {context.get('root_cause')}\n"
        f"Payment amount: {context.get('payment_amount')}\n"
        f"Payment method: {context.get('payment_method')}\n"
        f"Failure reason: {context.get('failure_reason')}\n"
        f"Retry count: {context.get('retry_count')}\n"
        f"ML-predicted recovery probability: {context.get('recovery_probability')}\n"
        f"Chosen recovery action: {context.get('candidate_intervention')}\n"
    )


def _is_rate_limited(error: Exception) -> bool:
    """True only for a genuine Gemini 429 (RESOURCE_EXHAUSTED) response."""
    return isinstance(error, genai_errors.APIError) and error.code == 429


def generate_diagnosis(context: dict[str, Any]) -> str | None:
    """
    Produces a natural-language diagnosis for one recovery case.

    Deliberately best-effort: the deterministic strategy/policy/execution
    path never depends on this output, so a Gemini outage or bad key must
    never block the actual bounded recovery workflow.

    On a rate-limit (429) response specifically, retries up to MAX_RETRIES
    times with exponential backoff plus jitter before giving up. Any other
    error (bad key, invalid model, network failure, etc.) fails immediately
    — retrying those would not help and would only add latency. If every
    retry on GEMINI_MODEL is still rate-limited, makes exactly one further
    attempt against GEMINI_FALLBACK_MODEL — a separate model with its own
    quota pool — before giving up. Never fabricates a response: if every
    attempt fails, returns None per the existing best-effort contract.
    """
    try:
        client = _get_client()
    except Exception as error:
        print(f"[llm] diagnosis generation failed: {type(error).__name__}")
        return None

    prompt = _build_prompt(context)
    primary_exhausted_on_rate_limit = False

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=config.GEMINI_MODEL,
                contents=prompt,
            )

            text = response.text
            return text.strip() if text else None
        except Exception as error:
            rate_limited = _is_rate_limited(error)
            category = "rate_limited_429" if rate_limited else "other"

            print(
                f"[llm] diagnosis generation attempt {attempt + 1}/{MAX_RETRIES + 1} "
                f"failed (category={category}, type={type(error).__name__})"
            )

            if not rate_limited:
                return None

            if attempt == MAX_RETRIES:
                primary_exhausted_on_rate_limit = True
                break

            backoff_seconds = BASE_BACKOFF_SECONDS * (2**attempt) + random.uniform(
                0, 0.25
            )
            time.sleep(backoff_seconds)

    if (
        not primary_exhausted_on_rate_limit
        or not config.GEMINI_FALLBACK_MODEL
        or config.GEMINI_FALLBACK_MODEL == config.GEMINI_MODEL
    ):
        return None

    try:
        response = client.models.generate_content(
            model=config.GEMINI_FALLBACK_MODEL,
            contents=prompt,
        )

        text = response.text

        if text:
            print(
                f"[llm] diagnosis generated via fallback model "
                f"{config.GEMINI_FALLBACK_MODEL} after {config.GEMINI_MODEL} "
                "was rate-limited on every retry."
            )

        return text.strip() if text else None
    except Exception as error:
        print(
            f"[llm] fallback model {config.GEMINI_FALLBACK_MODEL} also failed "
            f"(type={type(error).__name__})"
        )
        return None
