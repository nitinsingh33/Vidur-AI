import requests
from langchain_core.tools import tool

NESTJS_URL = "http://localhost:3000"

@tool
def payment_tool(order_id: str) -> dict:
    """
    Retrieve the Razorpay Test Mode order through the NestJS Razorpay integration.
    """

    response = requests.get(
        f"{NESTJS_URL}/razorpay/orders/{order_id}",
        timeout=10,
    )

    response.raise_for_status()

    return response.json()