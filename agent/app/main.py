from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel

from app.graph.workflow import build_recovery_graph
from app.llm.diagnosis import generate_diagnosis


PROJECT_ROOT = Path(__file__).resolve().parents[2]

MODEL_FILE = (
    PROJECT_ROOT
    / "ml"
    / "models"
    / "recovery_probability_model.joblib"
)


FEATURES = [
    "amount",
    "failure_reason",
    "payment_method",
    "customer_history",
    "previous_failures",
    "previous_successes",
    "customer_value",
    "retry_count",
    "retry_failed_events",
]


class RecoveryPredictionRequest(BaseModel):
    amount: float
    failure_reason: str
    payment_method: str
    customer_history: int
    previous_failures: int
    previous_successes: int
    customer_value: float
    retry_count: int
    retry_failed_events: int


class RecoveryPredictionResponse(BaseModel):
    recovery_probability: float

class RecoveryWorkflowRequest(BaseModel):
    recovery_case_id: str


class DiagnosisRequest(BaseModel):
    """
    Context for a single case, already assembled by the caller (either the
    LangGraph workflow's diagnose_case node, or the NestJS
    RecoveryAutoOrchestratorService calling this endpoint directly for the
    automatic path). This endpoint only narrates — it never decides the
    action, never touches policy, and never executes anything; the caller
    already made those decisions before calling this.
    """

    root_cause: str | None = None
    payment_amount: float | None = None
    payment_method: str | None = None
    failure_reason: str | None = None
    retry_count: int | None = None
    recovery_probability: float | None = None
    candidate_intervention: str | None = None


class DiagnosisResponse(BaseModel):
    reasoning: str | None


class RecoveryWorkflowResponse(BaseModel):
    recovery_case_id: str
    success: bool | None
    policy_decision: str | None
    candidate_intervention: str | None
    ai_reasoning: str | None


app = FastAPI(
    title="RecoverAI ML Service",
    version="1.0.0",
)


model = joblib.load(MODEL_FILE)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post(
    "/predict-recovery",
    response_model=RecoveryPredictionResponse,
)
def predict_recovery(
    request: RecoveryPredictionRequest,
):
    data = request.model_dump()

    row = pd.DataFrame(
        [data],
        columns=FEATURES,
    )

    probability = model.predict_proba(row)[0][1]

    return RecoveryPredictionResponse(
        recovery_probability=round(
            float(probability),
            4,
        )
    )

@app.post(
    "/diagnose",
    response_model=DiagnosisResponse,
)
def diagnose(request: DiagnosisRequest):
    """
    Narrow, narration-only endpoint: given case context already assembled
    and decided-upon by the caller, produces a natural-language explanation
    via Gemini (best-effort — see generate_diagnosis's own graceful-failure
    behavior). Does not run the rest of the recovery graph, so calling this
    from the automatic in-process orchestrator can never race with — or
    duplicate — that orchestrator's own execute/observe/escalate calls.
    """

    reasoning = generate_diagnosis(request.model_dump())

    return DiagnosisResponse(reasoning=reasoning)


@app.post(
    "/run-recovery",
    response_model=RecoveryWorkflowResponse,
)
def run_recovery(
    request: RecoveryWorkflowRequest,
):
    graph = build_recovery_graph()

    result = graph.invoke(
        {
            "recovery_case_id": request.recovery_case_id,
            "attempt": 0,
        }
    )

    return RecoveryWorkflowResponse(
        recovery_case_id=request.recovery_case_id,
        success=result.get("success"),
        policy_decision=result.get("policy_decision"),
        candidate_intervention=result.get(
            "candidate_intervention"
        ),
        ai_reasoning=result.get("ai_reasoning"),
    )