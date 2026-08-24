import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from app.tools.payment_tool import payment_tool


ORDER_ID = "order_TTVRA9M1hB1gg3"


def main():
    result = payment_tool.invoke({
        "order_id": ORDER_ID,
    })

    print("PaymentTool execution successful.")
    print(f"Razorpay order: {result['id']}")
    print(f"Amount: {result['amount']}")
    print(f"Status: {result['status']}")
    print(f"Attempts: {result['attempts']}")


if __name__ == "__main__":
    main()