import csv
import json
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SYNTHETIC_DIR = PROJECT_ROOT / "backend" / "data" / "synthetic"
OUTPUT_DIR = PROJECT_ROOT / "ml" / "data"

OUTPUT_FILE = OUTPUT_DIR / "training_data.csv"


def load_json(filename: str):
    with open(SYNTHETIC_DIR / filename, "r", encoding="utf-8") as file:
        return json.load(file)


def build_indexes(records, key):
    return {record[key]: record for record in records}


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    scenarios = load_json("scenario_ground_truth.json")
    payments = load_json("payments.json")
    customers = load_json("customers.json")
    payment_events = load_json("payment_events.json")

    payments_by_id = build_indexes(payments, "id")
    customers_by_id = build_indexes(customers, "id")

    customer_payments = defaultdict(list)

    for payment in payments:
        customer_payments[payment["customerId"]].append(payment)

    events_by_payment = defaultdict(list)

    for event in payment_events:
        events_by_payment[event["paymentId"]].append(event)

    rows = []

    for scenario in scenarios:
        customer_id = scenario["customerId"]
        payment_id = scenario["paymentId"]

        customer = customers_by_id.get(customer_id)

        if customer is None:
            raise ValueError(
                f"Customer {customer_id} not found for "
                f"scenario {scenario['scenarioId']}"
            )

        payment = payments_by_id.get(payment_id) if payment_id else None

        customer_history = customer_payments[customer_id]

        historical_payments = [
            item
            for item in customer_history
            if payment is None or item["id"] != payment["id"]
        ]

        previous_successes = sum(
            item["status"] == "CAPTURED"
            for item in historical_payments
        )

        previous_failures = sum(
            item["status"] == "FAILED"
            for item in historical_payments
        )

        customer_value = sum(
            float(item["amount"])
            for item in historical_payments
            if item["status"] == "CAPTURED"
        )

        if payment:
            amount = float(payment["amount"])
            failure_reason = payment["failureReason"] or "NONE"
            payment_method = payment["method"]
            retry_count = int(payment["attemptNumber"])

            payment_events_for_current = events_by_payment[payment_id]

            retry_failed_events = sum(
                event["type"] == "RETRY_FAILED"
                for event in payment_events_for_current
            )
        else:
            amount = float(
                scenario["recoveredAmount"]
            )
            failure_reason = "CHECKOUT_ABANDONED"
            payment_method = "NONE"
            retry_count = 0
            retry_failed_events = 0

        target = int(
            scenario["expectedOutcome"] == "RECOVERED"
        )

        rows.append(
            {
                "scenario_id": scenario["scenarioId"],
                "scenario_type": scenario["scenarioType"],
                "amount": amount,
                "failure_reason": failure_reason,
                "payment_method": payment_method,
                "customer_history": len(historical_payments),
                "previous_failures": previous_failures,
                "previous_successes": previous_successes,
                "customer_value": round(customer_value, 2),
                "retry_count": retry_count,
                "retry_failed_events": retry_failed_events,
                "target_recovered": target,
            }
        )

    fieldnames = [
        "scenario_id",
        "scenario_type",
        "amount",
        "failure_reason",
        "payment_method",
        "customer_history",
        "previous_failures",
        "previous_successes",
        "customer_value",
        "retry_count",
        "retry_failed_events",
        "target_recovered",
    ]

    with open(
        OUTPUT_FILE,
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames,
        )

        writer.writeheader()
        writer.writerows(rows)

    print("Training dataset created successfully.")
    print(f"Rows: {len(rows)}")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()