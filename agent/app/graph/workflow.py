import requests

from langgraph.graph import END, START, StateGraph

from .. import config
from ..llm.diagnosis import generate_diagnosis
from .state import RecoveryAgentState


FASTAPI_URL = config.ML_SERVICE_URL
NESTJS_URL = config.BACKEND_URL


def load_recovery_case(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    recovery_case_id = state["recovery_case_id"]

    response = requests.get(
        f"{NESTJS_URL}/recovery/cases/{recovery_case_id}",
        timeout=10,
    )

    response.raise_for_status()

    return {
        **state,
        "recovery_case": response.json(),
    }


def analyze_context(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    recovery_case = state["recovery_case"]
    payment = recovery_case.get("payment")

    return {
        **state,
        "root_cause": recovery_case.get("rootCause"),
        "payment_amount": (
            float(payment["amount"])
            if payment
            else None
        ),
        "payment_method": (
            payment["method"]
            if payment
            else None
        ),
        "failure_reason": (
            payment["failureReason"]
            if payment
            else None
        ),
        "retry_count": (
            payment["attemptNumber"]
            if payment
            else 0
        ),
    }


def get_recovery_probability(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    recovery_case_id = state["recovery_case_id"]

    features_response = requests.get(
        f"{NESTJS_URL}/recovery/cases/"
        f"{recovery_case_id}/ml-features",
        timeout=10,
    )

    features_response.raise_for_status()

    prediction_response = requests.post(
        f"{FASTAPI_URL}/predict-recovery",
        json=features_response.json(),
        timeout=10,
    )

    prediction_response.raise_for_status()

    prediction = prediction_response.json()

    return {
        **state,
        "recovery_probability": float(
            prediction["recovery_probability"]
        ),
    }


def select_intervention(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    recovery_case_id = state["recovery_case_id"]

    response = requests.post(
        f"{NESTJS_URL}/recovery/cases/"
        f"{recovery_case_id}/strategy",
        timeout=10,
    )

    response.raise_for_status()

    strategy = response.json()

    return {
        **state,
        "candidate_intervention": strategy["type"],
    }


def diagnose_case(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    """
    Narrates why this case is at risk and why the already-chosen
    intervention makes sense. The LLM explains a decision the deterministic
    strategy service already made — it never makes the decision itself,
    so a bad or missing Gemini key degrades gracefully, never blocks
    recovery, and never gets a say in what happens to the money.
    """
    reasoning = generate_diagnosis(
        {
            "root_cause": state.get("root_cause"),
            "payment_amount": state.get("payment_amount"),
            "payment_method": state.get("payment_method"),
            "failure_reason": state.get("failure_reason"),
            "retry_count": state.get("retry_count"),
            "recovery_probability": state.get("recovery_probability"),
            "candidate_intervention": state.get("candidate_intervention"),
        }
    )

    if reasoning:
        recovery_case_id = state["recovery_case_id"]

        try:
            requests.post(
                f"{NESTJS_URL}/recovery/cases/"
                f"{recovery_case_id}/diagnosis",
                json={"reasoning": reasoning},
                timeout=10,
            )
        except requests.RequestException as error:
            print(f"[llm] failed to persist diagnosis: {error}")

    return {
        **state,
        "ai_reasoning": reasoning,
    }


def policy_check(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    recovery_case_id = state["recovery_case_id"]
    candidate_intervention = state["candidate_intervention"]

    response = requests.post(
        f"{NESTJS_URL}/policies/check/"
        f"{recovery_case_id}/{candidate_intervention}",
        timeout=10,
    )

    response.raise_for_status()

    policy = response.json()

    return {
        **state,
        "policy_decision": policy["decision"],
    }


def route_after_policy(
    state: RecoveryAgentState,
) -> str:
    if state.get("policy_decision") == "ALLOW":
        return "execute"

    return "escalate"


def execute(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    recovery_case_id = state["recovery_case_id"]

    response = requests.post(
        f"{NESTJS_URL}/recovery/cases/"
        f"{recovery_case_id}/execute",
        timeout=10,
    )

    response.raise_for_status()

    return {
        **state,
        "execution_result": response.json(),
        "attempt": state.get("attempt", 0) + 1,
    }


def observe(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    recovery_case_id = state["recovery_case_id"]

    response = requests.post(
        f"{NESTJS_URL}/recovery/cases/"
        f"{recovery_case_id}/observe",
        timeout=10,
    )

    response.raise_for_status()

    outcome = response.json()

    return {
        **state,
        "success": bool(outcome.get("successful")),
        "execution_result": {
            **(state.get("execution_result") or {}),
            "outcome": outcome,
        },
    }


def route_after_observe(
    state: RecoveryAgentState,
) -> str:
    if state.get("success") is True:
        return "recover"

    outcome = state.get("execution_result", {}).get("outcome", {})

    if outcome.get("shouldRetry") is True:
        return "retry"

    return "escalate"


def recover(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    return state


def escalate(
    state: RecoveryAgentState,
) -> RecoveryAgentState:
    recovery_case_id = state["recovery_case_id"]

    outcome = (state.get("execution_result") or {}).get("outcome", {})
    policy_decision = state.get("policy_decision")

    if policy_decision == "DENY":
        reason = "Policy denied the intervention."
    elif outcome.get("shouldStop"):
        reason = "Retry limit exhausted — escalating to human review."
    else:
        reason = "Recovery failed after all attempts."

    response = requests.post(
        f"{NESTJS_URL}/escalation/cases/{recovery_case_id}",
        json={"reason": reason},
        timeout=10,
    )

    response.raise_for_status()

    return {
        **state,
        "escalation_result": response.json(),
    }



def build_recovery_graph():
    graph = StateGraph(RecoveryAgentState)

    graph.add_node(
        "load_recovery_case",
        load_recovery_case,
    )
    graph.add_node(
        "analyze_context",
        analyze_context,
    )
    graph.add_node(
        "get_recovery_probability",
        get_recovery_probability,
    )
    graph.add_node(
        "select_intervention",
        select_intervention,
    )
    graph.add_node(
        "diagnose_case",
        diagnose_case,
    )
    graph.add_node(
        "policy_check",
        policy_check,
    )
    graph.add_node(
        "execute",
        execute,
    )
    graph.add_node(
        "observe",
        observe,
    )
    graph.add_node(
        "recover",
        recover,
    )
    graph.add_node(
        "escalate",
        escalate,
    )

    graph.add_edge(
        START,
        "load_recovery_case",
    )

    graph.add_edge(
        "load_recovery_case",
        "analyze_context",
    )

    graph.add_edge(
        "analyze_context",
        "get_recovery_probability",
    )

    graph.add_edge(
        "get_recovery_probability",
        "select_intervention",
    )

    graph.add_edge(
        "select_intervention",
        "diagnose_case",
    )

    graph.add_edge(
        "diagnose_case",
        "policy_check",
    )

    graph.add_conditional_edges(
        "policy_check",
        route_after_policy,
        {
            "execute": "execute",
            "escalate": "escalate",
        },
    )

    graph.add_edge(
        "execute",
        "observe",
    )

    graph.add_conditional_edges(
        "observe",
        route_after_observe,
        {
            "recover": "recover",
            "retry": "select_intervention",
            "escalate": "escalate",
        },
    )

    graph.add_edge(
        "recover",
        END,
    )

    graph.add_edge(
        "escalate",
        END,
    )

    return graph.compile()