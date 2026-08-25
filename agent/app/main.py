from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel

from app.graph.workflow import build_recovery_graph


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