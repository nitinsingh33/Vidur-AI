import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))


from app.graph.workflow import execute


def main():
    result = execute({
        "recovery_case_id": "80738502-b206-4395-b4d6-c2e79f3f4c8e",
        "attempt": 0,
    })

    payment_result = result["execution_result"]

    print("LangGraph PaymentTool execution successful.")
    print(
        f"Razorpay order: "
        f"{payment_result['id']}"
    )
    print(
        f"Razorpay status: "
        f"{payment_result['status']}"
    )
    print(
        f"Attempts: "
        f"{payment_result['attempts']}"
    )


if __name__ == "__main__":
    main()