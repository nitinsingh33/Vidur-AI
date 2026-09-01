import sys
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from app.llm import diagnosis
from google.genai import errors as genai_errors


CONTEXT = {
    "root_cause": "subscription_failed",
    "payment_amount": 999,
    "payment_method": "CARD",
    "failure_reason": "insufficient_funds",
    "retry_count": 1,
    "recovery_probability": 0.6,
    "candidate_intervention": "RETRY_PAYMENT",
}


def _rate_limit_error() -> genai_errors.APIError:
    return genai_errors.APIError(
        429, {"error": {"message": "Resource exhausted", "status": "RESOURCE_EXHAUSTED"}}
    )


def _make_response(text: str) -> MagicMock:
    response = MagicMock()
    response.text = text
    return response


def _reset_client():
    diagnosis._client = None


def test_successful_diagnosis_first_attempt():
    """(a) A normal, successful call returns the real text on the first try."""
    _reset_client()

    with patch.object(diagnosis.config, "GEMINI_API_KEY", "fake-key"), patch(
        "app.llm.diagnosis.genai.Client"
    ) as MockClient:
        instance = MockClient.return_value
        instance.models.generate_content.return_value = _make_response(
            "Card payment failed due to insufficient funds; a payment link is the correct next step."
        )

        result = diagnosis.generate_diagnosis(CONTEXT)

        assert result == (
            "Card payment failed due to insufficient funds; a payment link is the correct next step."
        )
        assert instance.models.generate_content.call_count == 1


def test_429_then_success_on_retry():
    """(b) First attempt 429s, retry succeeds — no fabricated text, real retry."""
    _reset_client()

    with patch.object(diagnosis.config, "GEMINI_API_KEY", "fake-key"), patch(
        "app.llm.diagnosis.genai.Client"
    ) as MockClient, patch("app.llm.diagnosis.time.sleep") as mock_sleep:
        instance = MockClient.return_value
        instance.models.generate_content.side_effect = [
            _rate_limit_error(),
            _make_response("Recovered on second attempt."),
        ]

        result = diagnosis.generate_diagnosis(CONTEXT)

        assert result == "Recovered on second attempt."
        assert instance.models.generate_content.call_count == 2
        # Backoff actually happened, but tests never sleep for real.
        assert mock_sleep.call_count == 1


def test_repeated_429_returns_none_without_crashing():
    """(c) Every attempt 429s -> None, bounded to MAX_RETRIES, no exception raised."""
    _reset_client()

    with patch.object(diagnosis.config, "GEMINI_API_KEY", "fake-key"), patch(
        "app.llm.diagnosis.genai.Client"
    ) as MockClient, patch("app.llm.diagnosis.time.sleep") as mock_sleep:
        instance = MockClient.return_value
        instance.models.generate_content.side_effect = _rate_limit_error()

        result = diagnosis.generate_diagnosis(CONTEXT)

        assert result is None
        # Bounded: exactly MAX_RETRIES + 1 attempts, never more.
        assert instance.models.generate_content.call_count == diagnosis.MAX_RETRIES + 1
        assert mock_sleep.call_count == diagnosis.MAX_RETRIES


def test_non_429_error_fails_fast_without_retry():
    """A non-rate-limit error (bad model, network failure, etc.) must not retry."""
    _reset_client()

    with patch.object(diagnosis.config, "GEMINI_API_KEY", "fake-key"), patch(
        "app.llm.diagnosis.genai.Client"
    ) as MockClient, patch("app.llm.diagnosis.time.sleep") as mock_sleep:
        instance = MockClient.return_value
        instance.models.generate_content.side_effect = RuntimeError(
            "network unreachable"
        )

        result = diagnosis.generate_diagnosis(CONTEXT)

        assert result is None
        assert instance.models.generate_content.call_count == 1
        mock_sleep.assert_not_called()


def _run(name, fn):
    try:
        fn()
        print(f"PASS: {name}")
        return True
    except AssertionError as error:
        print(f"FAIL: {name}: {error}")
        return False


if __name__ == "__main__":
    tests = [
        ("test_successful_diagnosis_first_attempt", test_successful_diagnosis_first_attempt),
        ("test_429_then_success_on_retry", test_429_then_success_on_retry),
        ("test_repeated_429_returns_none_without_crashing", test_repeated_429_returns_none_without_crashing),
        ("test_non_429_error_fails_fast_without_retry", test_non_429_error_fails_fast_without_retry),
    ]

    results = [_run(name, fn) for name, fn in tests]

    print(f"\n{sum(results)}/{len(results)} passed")
    if not all(results):
        sys.exit(1)
