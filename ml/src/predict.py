from pathlib import Path

import joblib
import pandas as pd


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


def predict_recovery_probability(data: dict) -> float:
    model = joblib.load(MODEL_FILE)

    row = pd.DataFrame(
        [data],
        columns=FEATURES,
    )

    probability = model.predict_proba(row)[0][1]

    return round(float(probability), 4)


if __name__ == "__main__":
    example = {
        "amount": 2314.73,
        "failure_reason": "INSUFFICIENT_FUNDS",
        "payment_method": "UPI",
        "customer_history": 7,
        "previous_failures": 2,
        "previous_successes": 5,
        "customer_value": 27611.93,
        "retry_count": 2,
        "retry_failed_events": 0,
    }

    probability = predict_recovery_probability(
        example
    )

    print(
        f"recovery_probability = {probability}"
    )