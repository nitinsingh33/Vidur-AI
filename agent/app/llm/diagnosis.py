from typing import Any

from google import genai

from .. import config

_client = None


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


def generate_diagnosis(context: dict[str, Any]) -> str | None:
    """
    Produces a natural-language diagnosis for one recovery case.

    Deliberately best-effort: the deterministic strategy/policy/execution
    path never depends on this output, so a Gemini outage or bad key must
    never block the actual bounded recovery workflow.
    """
    try:
        client = _get_client()
        prompt = _build_prompt(context)

        response = client.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=prompt,
        )

        text = response.text

        return text.strip() if text else None
    except Exception as error:
        print(f"[llm] diagnosis generation failed: {error}")
        return None
