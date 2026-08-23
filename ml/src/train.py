import json
from pathlib import Path

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_FILE = PROJECT_ROOT / "ml" / "data" / "training_data.csv"
MODEL_DIR = PROJECT_ROOT / "ml" / "models"

MODEL_FILE = MODEL_DIR / "recovery_probability_model.joblib"
METRICS_FILE = MODEL_DIR / "metrics.json"


NUMERIC_FEATURES = [
    "amount",
    "customer_history",
    "previous_failures",
    "previous_successes",
    "customer_value",
    "retry_count",
    "retry_failed_events",
]

CATEGORICAL_FEATURES = [
    "failure_reason",
    "payment_method",
]


def main():
    df = pd.read_csv(DATA_FILE)

    features = NUMERIC_FEATURES + CATEGORICAL_FEATURES

    X = df[features]
    y = df["target_recovered"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                StandardScaler(),
                NUMERIC_FEATURES,
            ),
            (
                "categorical",
                OneHotEncoder(
                    handle_unknown="ignore",
                ),
                CATEGORICAL_FEATURES,
            ),
        ]
    )

    model = Pipeline(
        steps=[
            (
                "preprocessor",
                preprocessor,
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=1000,
                    random_state=42,
                ),
            ),
        ]
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]

    accuracy = accuracy_score(
        y_test,
        predictions,
    )

    roc_auc = roc_auc_score(
        y_test,
        probabilities,
    )

    report = classification_report(
        y_test,
        predictions,
        output_dict=True,
        zero_division=0,
    )

    matrix = confusion_matrix(
        y_test,
        predictions,
    )

    metrics = {
        "model": "LogisticRegression",
        "dataset_size": len(df),
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": accuracy,
        "roc_auc": roc_auc,
        "classification_report": report,
        "confusion_matrix": matrix.tolist(),
    }

    MODEL_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    joblib.dump(
        model,
        MODEL_FILE,
    )

    with open(
        METRICS_FILE,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            metrics,
            file,
            indent=2,
        )

    print("Logistic Regression training completed.")
    print(f"Dataset size: {len(df)}")
    print(f"Training samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")
    print(f"Accuracy: {accuracy:.4f}")
    print(f"ROC-AUC: {roc_auc:.4f}")
    print("\nConfusion Matrix:")
    print(matrix)
    print("\nClassification Report:")
    print(
        classification_report(
            y_test,
            predictions,
            zero_division=0,
        )
    )
    print(f"Model: {MODEL_FILE}")
    print(f"Metrics: {METRICS_FILE}")


if __name__ == "__main__":
    main()