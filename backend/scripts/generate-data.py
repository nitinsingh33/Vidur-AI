from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

# Explicitly resolve paths to place data inside backend/data/synthetic
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = BACKEND_DIR / "data" / "synthetic"

FAILURE_REASONS = [
    "INSUFFICIENT_FUNDS",
    "CARD_EXPIRED",
    "BANK_DECLINED",
    "NETWORK_ERROR",
    "LIMIT_EXCEEDED",
]

PAYMENT_METHODS = [
    "CARD",
    "UPI",
    "NETBANKING",
    "WALLET",
]

MERCHANT_INDUSTRIES = [
    "SAAS",
    "ECOMMERCE",
    "EDUCATION",
    "SUBSCRIPTION",
    "B2B_SERVICES",
]

CUSTOMER_PROFILES = [
    "RELIABLE",
    "NORMAL",
    "OCCASIONAL_FAILURE",
    "HIGH_RISK",
    "B2B_RELIABLE",
]


def now_utc():
    return datetime.now(timezone.utc)


def iso(dt: datetime):
    return dt.isoformat()


def money(value: float | Decimal):
    return f"{Decimal(str(value)).quantize(Decimal('0.01'))}"


def weighted_choice(rng, choices):
    values = [x[0] for x in choices]
    weights = [x[1] for x in choices]
    return rng.choices(values, weights=weights, k=1)[0]


def write_json(filename: str, data):
    path = OUTPUT_DIR / filename
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return path


def generate_merchants(rng, count):
    merchants = []

    for i in range(count):
        merchant_id = str(uuid4())

        merchants.append({
            "id": merchant_id,
            "name": f"Merchant {i + 1:04d}",
            "email": f"merchant{i + 1:04d}@example.com",
            "currency": "INR",
            "industry": rng.choice(MERCHANT_INDUSTRIES),
        })

    return merchants


def generate_customers(rng, merchants, count):
    customers = []

    for i in range(count):
        merchant = rng.choice(merchants)
        profile = weighted_choice(
            rng,
            [
                ("RELIABLE", 35),
                ("NORMAL", 40),
                ("OCCASIONAL_FAILURE", 15),
                ("HIGH_RISK", 7),
                ("B2B_RELIABLE", 3),
            ],
        )

        customers.append({
            "id": str(uuid4()),
            "merchantId": merchant["id"],
            "externalId": f"CUST-{i + 1:06d}",
            "name": f"Customer {i + 1:06d}",
            "email": f"customer{i + 1:06d}@example.com",
            "phone": f"+919000{i:06d}",
            "profile": profile,
        })

    return customers


def customer_success_probability(profile):
    return {
        "RELIABLE": 0.96,
        "NORMAL": 0.88,
        "OCCASIONAL_FAILURE": 0.70,
        "HIGH_RISK": 0.42,
        "B2B_RELIABLE": 0.94,
    }[profile]


def random_order_amount(rng, industry):
    if industry == "B2B_SERVICES":
        return rng.uniform(10000, 150000)

    if industry == "SAAS":
        return rng.uniform(499, 9999)

    if industry == "EDUCATION":
        return rng.uniform(999, 30000)

    if industry == "SUBSCRIPTION":
        return rng.uniform(299, 4999)

    return rng.uniform(199, 15000)


def generate_orders(rng, merchants, customers, count):
    orders = []

    for _ in range(count):
        customer = rng.choice(customers)

        merchant = next(
            m for m in merchants
            if m["id"] == customer["merchantId"]
        )

        created = now_utc() - timedelta(
            days=rng.randint(0, 180),
            hours=rng.randint(0, 23),
        )

        orders.append({
            "id": str(uuid4()),
            "merchantId": merchant["id"],
            "customerId": customer["id"],
            "amount": money(random_order_amount(rng, merchant["industry"])),
            "currency": "INR",
            "createdAt": iso(created),
        })

    return orders


def generate_payments(rng, merchants, customers, orders, target_count):
    payments = []
    
    # Reserve some orders for Scenario C.
    # These orders must NOT have a successful payment.
    abandonment_orders = set(
        order["id"] for order in orders[:10]
    )

    # First payment for normal order.
    for order in orders:
        if order["id"] in abandonment_orders:
            continue

        customer = next(
            c for c in customers
            if c["id"] == order["customerId"]
        )

        payment_id = str(uuid4())

        payments.append({
            "id": payment_id,
            "merchantId": order["merchantId"],
            "customerId": customer["id"],
            "orderId": order["id"],
            "amount": order["amount"],
            "currency": "INR",
            "method": rng.choice(PAYMENT_METHODS),
            "status": "CAPTURED",
            "failureReason": None,
            "attemptNumber": 1,
            "externalId": f"pay_{payment_id[:12]}",
        })

    # Add failed/retry attempts until target count.
    remaining = target_count - len(payments)

    for _ in range(max(0, remaining)):
        base_payment = rng.choice(payments)
        payment_id = str(uuid4())

        payments.append({
            "id": payment_id,
            "merchantId": base_payment["merchantId"],
            "customerId": base_payment["customerId"],
            "orderId": base_payment["orderId"],
            "amount": base_payment["amount"],
            "currency": "INR",
            "method": base_payment["method"],
            "status": "FAILED",
            "failureReason": rng.choice(FAILURE_REASONS),
            "attemptNumber": 2,
            "externalId": f"pay_{payment_id[:12]}",
        })

    return payments


def apply_scenarios(rng, payments, orders, customers, invoices, events):
    scenarios = []

    # Filter actual failed payments for scenarios requiring failure
    failed_payments = [p for p in payments if p["status"] == "FAILED"]

    # ---------------------------------------------------------
    # Scenario A
    # INSUFFICIENT_FUNDS -> RETRY_PAYMENT -> RECOVERED
    # ---------------------------------------------------------


    # Make sure we have enough controlled examples.
    for payment in failed_payments[0:10]:
        payment["status"] = "FAILED"
        payment["failureReason"] = "INSUFFICIENT_FUNDS"

        scenarios.append({
            "scenarioId": f"SCN-{len(scenarios) + 1:06d}",
            "scenarioType": "INSUFFICIENT_FUNDS_RECOVERY",
            "customerId": payment["customerId"],
            "orderId": payment["orderId"],
            "paymentId": payment["id"],
            "invoiceId": None,
            "expectedIntervention": "RETRY_PAYMENT",
            "expectedOutcome": "RECOVERED",
            "recoveredAmount": payment["amount"],
        })

    # ---------------------------------------------------------
    # Scenario B
    # CARD_EXPIRED -> UPDATE_PAYMENT_METHOD
    # ---------------------------------------------------------

    for payment in failed_payments[10:20]:
        payment["method"] = "CARD"
        payment["failureReason"] = "CARD_EXPIRED"
        payment["status"] = "FAILED"

        scenarios.append({
            "scenarioId": f"SCN-{len(scenarios) + 1:06d}",
            "scenarioType": "EXPIRED_CARD",
            "customerId": payment["customerId"],
            "paymentId": payment["id"],
            "orderId": payment["orderId"],
            "invoiceId": None,
            "expectedIntervention": "UPDATE_PAYMENT_METHOD",
            "expectedOutcome": "PAYMENT_METHOD_UPDATE_REQUIRED",
            "recoveredAmount": "0.00",
        })

    
    # ---------------------------------------------------------
    # Scenario C
    # CHECKOUT_ABANDONMENT
    #
    # These orders intentionally have NO payment.
    # ---------------------------------------------------------

    abandonment_orders = orders[:10]

    for order in abandonment_orders:
        has_payment = any(
            p["orderId"] == order["id"]
            for p in payments
        )

        if has_payment:
            raise ValueError(
                f"Scenario C order {order['id']} unexpectedly has a payment"
            )

        scenarios.append({
            "scenarioId": f"SCN-{len(scenarios) + 1:06d}",
            "scenarioType": "CHECKOUT_ABANDONMENT",
            "customerId": order["customerId"],
            "orderId": order["id"],
            "paymentId": None,
            "invoiceId": None,
            "expectedIntervention": "SEND_PAYMENT_LINK",
            "expectedOutcome": "RECOVERED",
            "recoveredAmount": order["amount"],
        })

    # ---------------------------------------------------------
    # Scenario D
    # OVERDUE_RECEIVABLE
    #
    # IMPORTANT:
    # Select an ACTUAL overdue invoice.
    # Prefer reliable customers.
    # ---------------------------------------------------------

    reliable_customer_ids = {
        c["id"]
        for c in customers
        if c["profile"] in {
            "RELIABLE",
            "B2B_RELIABLE",
        }
    }

    overdue_invoices = [
        invoice
        for invoice in invoices
        if invoice["status"] == "OVERDUE"
        and invoice["customerId"] in reliable_customer_ids
    ]

    for invoice in overdue_invoices[:10]:
        scenarios.append({
            "scenarioId": f"SCN-{len(scenarios) + 1:06d}",
            "scenarioType": "OVERDUE_RECEIVABLE",
            "customerId": invoice["customerId"],
            "paymentId": None,
            "orderId": None,
            "invoiceId": invoice["id"],
            "expectedIntervention": "FOLLOW_UP_RECEIVABLE",
            "expectedOutcome": "RECOVERED",
            "recoveredAmount": invoice["amount"],
        })

    # ---------------------------------------------------------
    # Scenario E
    # REPEATED_FAILURE_ESCALATION
    #
    # Select payments that have explicit repeated failure
    # event history.
    # ---------------------------------------------------------

    repeated_payment_ids = {
        event["paymentId"]
        for event in events
        if event["type"] == "RETRY_FAILED"
    }

    repeated_candidates = [
        p for p in payments
        if p["id"] in repeated_payment_ids
    ]

    for payment in repeated_candidates[:10]:
        payment["status"] = "FAILED"
        payment["failureReason"] = "BANK_DECLINED"
        payment["attemptNumber"] = 3

        payment_events = [
            e for e in events
            if e["paymentId"] == payment["id"]
        ]

        retry_failed_count = sum(
            1
            for e in payment_events
            if e["type"] == "RETRY_FAILED"
        )

        if retry_failed_count < 2:
            continue

        scenarios.append({
            "scenarioId": f"SCN-{len(scenarios) + 1:06d}",
            "scenarioType": "REPEATED_FAILURE_ESCALATION",
            "customerId": payment["customerId"],
            "orderId": payment["orderId"],
            "paymentId": payment["id"],
            "invoiceId": None,
            "expectedIntervention": "ESCALATE_HUMAN",
            "expectedOutcome": "ESCALATED",
            "recoveredAmount": "0.00",
        })

    return scenarios


def generate_subscriptions(rng, merchants, customers, count):
    subscriptions = []

    eligible_customers = [
        c for c in customers
        if c["profile"] in {
            "RELIABLE",
            "NORMAL",
            "OCCASIONAL_FAILURE",
        }
    ]

    for _ in range(count):
        customer = rng.choice(eligible_customers)

        created = now_utc() - timedelta(
            days=rng.randint(30, 300)
        )

        status = weighted_choice(
            rng,
            [
                ("ACTIVE", 75),
                ("PAYMENT_FAILED", 12),
                ("PAUSED", 5),
                ("CANCELLED", 5),
                ("EXPIRED", 3),
            ],
        )

        subscriptions.append({
            "id": str(uuid4()),
            "merchantId": customer["merchantId"],
            "customerId": customer["id"],
            "amount": money(rng.uniform(299, 4999)),
            "currency": "INR",
            "status": status,
            "nextBillingAt": iso(
                now_utc() + timedelta(days=rng.randint(1, 30))
            ),
            "failedPaymentCount": (
                rng.randint(1, 3)
                if status == "PAYMENT_FAILED"
                else 0
            ),
            "createdAt": iso(created),
        })

    return subscriptions


def generate_invoices(rng, merchants, customers, count):
    invoices = []

    for _ in range(count):
        customer = rng.choice(customers)

        issued = now_utc() - timedelta(
            days=rng.randint(0, 120)
        )

        status = weighted_choice(
            rng,
            [
                ("PAID", 65),
                ("ISSUED", 15),
                ("OVERDUE", 15),
                ("PARTIALLY_PAID", 5),
            ],
        )

        due_date = issued + timedelta(days=30)

        paid_at = None

        if status == "PAID":
            paid_at = iso(
                due_date + timedelta(
                    days=rng.randint(-5, 10)
                )
            )

        invoices.append({
            "id": str(uuid4()),
            "merchantId": customer["merchantId"],
            "customerId": customer["id"],
            "amount": money(rng.uniform(5000, 150000)),
            "currency": "INR",
            "status": status,
            "dueDate": iso(due_date),
            "paidAt": paid_at,
        })

    return invoices


def generate_payment_events(rng, payments, target_count):
    events = []

    for payment in payments:
        if payment["status"] == "CAPTURED":
            event_types = [
                "CREATED",
                "AUTHORIZED",
                "CAPTURED",
            ]

        elif payment["status"] == "FAILED":
            event_types = [
                "CREATED",
                "FAILED",
            ]

        else:
            event_types = [
                "CREATED",
            ]

        base_time = now_utc() - timedelta(
            minutes=rng.randint(1, 100000)
        )

        for index, event_type in enumerate(event_types):
            events.append({
                "id": str(uuid4()),
                "paymentId": payment["id"],
                "type": event_type,
                "reason": payment["failureReason"],
                "metadata": {},
                "occurredAt": iso(
                    base_time + timedelta(minutes=index)
                ),
            })

    # Create explicit repeated-failure histories.
    failed_payments = [
        p for p in payments
        if p["status"] == "FAILED"
    ]

    repeated_candidates = failed_payments[20:30]

    for payment in repeated_candidates:
        payment["failureReason"] = "BANK_DECLINED"
        payment["attemptNumber"] = 3

        base_time = now_utc() - timedelta(
            days=rng.randint(1, 30)
        )

        repeated_events = [
            ("CREATED", 0),
            ("FAILED", 1),
            ("RETRY_STARTED", 2),
            ("RETRY_FAILED", 3),
            ("RETRY_STARTED", 4),
            ("RETRY_FAILED", 5),
        ]

        for event_type, offset in repeated_events:
            events.append({
                "id": str(uuid4()),
                "paymentId": payment["id"],
                "type": event_type,
                "reason": "BANK_DECLINED",
                "metadata": {
                    "attemptNumber": 3 if offset >= 2 else 1
                },
                "occurredAt": iso(
                    base_time + timedelta(minutes=offset)
                ),
            })

    # Fill remaining events.
    retry_candidates = [
        p for p in failed_payments
    ]

    while len(events) < target_count and retry_candidates:
        payment = rng.choice(retry_candidates)

        events.append({
            "id": str(uuid4()),
            "paymentId": payment["id"],
            "type": rng.choice([
                "RETRY_STARTED",
                "RETRY_FAILED",
            ]),
            "reason": payment["failureReason"],
            "metadata": {},
            "occurredAt": iso(
                now_utc() + timedelta(
                    minutes=rng.randint(1, 100000)
                ),
            ),
        })

    return events



def validate(
    merchants,
    customers,
    orders,
    payments,
    subscriptions,
    invoices,
    events,
    scenarios,
):
    merchant_ids = {m["id"] for m in merchants}
    customer_ids = {c["id"] for c in customers}
    order_ids = {o["id"] for o in orders}
    payment_ids = {p["id"] for p in payments}

    errors = []

    invoice_ids = {i["id"] for i in invoices}

    # ---------------------------------------------------------
    # Scenario validation
    # ---------------------------------------------------------

    for scenario in scenarios:
        scenario_type = scenario["scenarioType"]

        if scenario.get("paymentId"):
            if scenario["paymentId"] not in payment_ids:
                errors.append(
                    f"Scenario {scenario['scenarioId']} references missing payment"
                )

        if scenario.get("orderId"):
            if scenario["orderId"] not in order_ids:
                errors.append(
                    f"Scenario {scenario['scenarioId']} references missing order"
                )

        if scenario.get("customerId"):
            if scenario["customerId"] not in customer_ids:
                errors.append(
                    f"Scenario {scenario['scenarioId']} references missing customer"
                )

        if scenario.get("invoiceId"):
            if scenario["invoiceId"] not in invoice_ids:
                errors.append(
                    f"Scenario {scenario['scenarioId']} references missing invoice"
                )

        # Scenario A
        if scenario_type == "INSUFFICIENT_FUNDS_RECOVERY":
            payment = next(
                p for p in payments
                if p["id"] == scenario["paymentId"]
            )

            if payment["status"] != "FAILED":
                errors.append(
                    f"Scenario {scenario['scenarioId']} payment is not FAILED"
                )

            if payment["failureReason"] != "INSUFFICIENT_FUNDS":
                errors.append(
                    f"Scenario {scenario['scenarioId']} has wrong failure reason"
                )

            if scenario["expectedIntervention"] != "RETRY_PAYMENT":
                errors.append(
                    f"Scenario {scenario['scenarioId']} has wrong intervention"
                )

        # Scenario B
        elif scenario_type == "EXPIRED_CARD":
            payment = next(
                p for p in payments
                if p["id"] == scenario["paymentId"]
            )

            if payment["status"] != "FAILED":
                errors.append(
                    f"Scenario {scenario['scenarioId']} payment is not FAILED"
                )

            if payment["method"] != "CARD":
                errors.append(
                    f"Scenario {scenario['scenarioId']} payment is not CARD"
                )

            if payment["failureReason"] != "CARD_EXPIRED":
                errors.append(
                    f"Scenario {scenario['scenarioId']} failure reason is not CARD_EXPIRED"
                )

            if scenario["expectedIntervention"] != "UPDATE_PAYMENT_METHOD":
                errors.append(
                    f"Scenario {scenario['scenarioId']} has wrong intervention"
                )

        # Scenario C
        elif scenario_type == "CHECKOUT_ABANDONMENT":
            order_id = scenario["orderId"]

            order_payments = [
                p for p in payments
                if p["orderId"] == order_id
            ]

            successful_payments = [
                p for p in order_payments
                if p["status"] in {
                    "AUTHORIZED",
                    "CAPTURED",
                }
            ]

            if successful_payments:
                errors.append(
                    f"Scenario {scenario['scenarioId']} has successful payment"
                )

            if scenario["expectedIntervention"] != "SEND_PAYMENT_LINK":
                errors.append(
                    f"Scenario {scenario['scenarioId']} has wrong intervention"
                )

        # Scenario D
        elif scenario_type == "OVERDUE_RECEIVABLE":
            invoice = next(
                i for i in invoices
                if i["id"] == scenario["invoiceId"]
            )

            if invoice["status"] != "OVERDUE":
                errors.append(
                    f"Scenario {scenario['scenarioId']} invoice is not OVERDUE"
                )

            if invoice["customerId"] != scenario["customerId"]:
                errors.append(
                    f"Scenario {scenario['scenarioId']} customer/invoice mismatch"
                )

            if scenario["expectedIntervention"] != "FOLLOW_UP_RECEIVABLE":
                errors.append(
                    f"Scenario {scenario['scenarioId']} has wrong intervention"
                )

        # Scenario E
        elif scenario_type == "REPEATED_FAILURE_ESCALATION":
            payment = next(
                p for p in payments
                if p["id"] == scenario["paymentId"]
            )

            payment_events = [
                e for e in events
                if e["paymentId"] == payment["id"]
            ]

            retry_failed_count = sum(
                1
                for e in payment_events
                if e["type"] == "RETRY_FAILED"
            )

            if retry_failed_count < 2:
                errors.append(
                    f"Scenario {scenario['scenarioId']} does not have repeated failures"
                )

            if payment["status"] != "FAILED":
                errors.append(
                    f"Scenario {scenario['scenarioId']} payment is not FAILED"
                )

            if payment["attemptNumber"] < 3:
                errors.append(
                    f"Scenario {scenario['scenarioId']} attemptNumber is less than 3"
                )

            if scenario["expectedIntervention"] != "ESCALATE_HUMAN":
                errors.append(
                    f"Scenario {scenario['scenarioId']} has wrong intervention"
                )

    for customer in customers:
        if customer["merchantId"] not in merchant_ids:
            errors.append(
                f"Customer {customer['id']} references missing merchant"
            )

    for order in orders:
        if order["merchantId"] not in merchant_ids:
            errors.append(
                f"Order {order['id']} references missing merchant"
            )

        if order["customerId"] not in customer_ids:
            errors.append(
                f"Order {order['id']} references missing customer"
            )

    for payment in payments:
        if payment["merchantId"] not in merchant_ids:
            errors.append(
                f"Payment {payment['id']} references missing merchant"
            )

        if payment["customerId"] not in customer_ids:
            errors.append(
                f"Payment {payment['id']} references missing customer"
            )

        if payment["orderId"] not in order_ids:
            errors.append(
                f"Payment {payment['id']} references missing order"
            )

    for event in events:
        if event["paymentId"] not in payment_ids:
            errors.append(
                f"Event {event['id']} references missing payment"
            )

    scenario_types = {
        s["scenarioType"]
        for s in scenarios
    }

    required_scenarios = {
        "INSUFFICIENT_FUNDS_RECOVERY",
        "EXPIRED_CARD",
        "CHECKOUT_ABANDONMENT",
        "OVERDUE_RECEIVABLE",
        "REPEATED_FAILURE_ESCALATION",
    }

    missing = required_scenarios - scenario_types

    if missing:
        errors.append(
            f"Missing scenarios: {sorted(missing)}"
        )

    if errors:
        raise ValueError(
            "\n".join(errors)
        )

    return True

def generate_metadata(args, counts):
    return {
        "datasetName": "RecoverAI Synthetic Revenue Recovery Dataset",
        "datasetType": "SYNTHETIC",
        "synthetic": True,
        "generatorVersion": "phase-2-v1",
        "scale": args.scale,
        "randomSeed": args.seed,
        "generatedAt": iso(now_utc()),
        "counts": counts,
    }


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--scale",
        choices=["small", "full"],
        default="small",
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
    )

    args = parser.parse_args()

    rng = random.Random(args.seed)

    if args.scale == "small":
        merchant_count = 5
        customer_count = 100
        order_count = 500
        payment_count = 700
        subscription_count = 100
        invoice_count = 200
        event_count = 1000
    else:
        merchant_count = 100
        customer_count = 10000
        order_count = 50000
        payment_count = 70000
        subscription_count = 10000
        invoice_count = 20000
        event_count = 100000

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("Generating merchants...")
    merchants = generate_merchants(
        rng,
        merchant_count,
    )

    print("Generating customers...")
    customers = generate_customers(
        rng,
        merchants,
        customer_count,
    )

    print("Generating orders...")
    orders = generate_orders(
        rng,
        merchants,
        customers,
        order_count,
    )

    print("Generating payments...")
    payments = generate_payments(
        rng,
        merchants,
        customers,
        orders,
        payment_count,
    )

    print("Generating subscriptions...")
    subscriptions = generate_subscriptions(
        rng,
        merchants,
        customers,
        subscription_count,
    )

    print("Generating invoices...")
    invoices = generate_invoices(
        rng,
        merchants,
        customers,
        invoice_count,
    )

    print("Generating payment events...")
    events = generate_payment_events(
        rng,
        payments,
        event_count,
    )

    print("Generating ground-truth scenarios...")
    scenarios = apply_scenarios(
        rng,
        payments,
        orders,
        customers,
        invoices,
        events,
    )

    print("Validating...")
    validate(
        merchants,
        customers,
        orders,
        payments,
        subscriptions,
        invoices,
        events,
        scenarios,
    )

    print("Writing JSON files...")

    write_json("merchants.json", merchants)
    write_json("customers.json", customers)
    write_json("orders.json", orders)
    write_json("payments.json", payments)
    write_json("subscriptions.json", subscriptions)
    write_json("invoices.json", invoices)
    write_json("payment_events.json", events)
    write_json("scenario_ground_truth.json", scenarios)

    metadata = generate_metadata(
        args,
        {
            "merchants": len(merchants),
            "customers": len(customers),
            "orders": len(orders),
            "payments": len(payments),
            "subscriptions": len(subscriptions),
            "invoices": len(invoices),
            "paymentEvents": len(events),
            "scenarios": len(scenarios),
        },
    )

    write_json("dataset_metadata.json", metadata)


    print()
    print("===================================")
    print("Synthetic dataset generated")
    print("===================================")
    print(f"Output Directory: {OUTPUT_DIR}")
    print(f"Merchants:       {len(merchants)}")
    print(f"Customers:       {len(customers)}")
    print(f"Orders:          {len(orders)}")
    print(f"Payments:        {len(payments)}")
    print(f"Subscriptions:   {len(subscriptions)}")
    print(f"Invoices:        {len(invoices)}")
    print(f"Payment events:  {len(events)}")
    print(f"Scenarios:       {len(scenarios)}")
    print("===================================")


if __name__ == "__main__":
    main()
