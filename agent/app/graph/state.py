from typing import Any, TypedDict


class RecoveryAgentState(TypedDict, total=False):
    recovery_case_id: str

    recovery_case: dict[str, Any]

    root_cause: str | None
    payment_amount: float | None
    payment_method: str | None
    failure_reason: str | None
    retry_count: int | None

    recovery_probability: float | None

    candidate_intervention: str | None

    ai_reasoning: str | None

    policy_decision: str | None

    execution_result: dict[str, Any] | None

    success: bool | None

    attempt: int

    escalation_result: dict[str, Any] | None
