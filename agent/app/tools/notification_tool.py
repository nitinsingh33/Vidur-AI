import requests
from langchain_core.tools import tool


NESTJS_URL = "http://localhost:3000"


@tool
def notification_tool(
    to: str,
    subject: str,
    message: str,
) -> dict:
    """
    Send a recovery notification through the NestJS
    notification business layer.
    """

    response = requests.post(
        f"{NESTJS_URL}/notifications/recovery",
        json={
            "to": to,
            "subject": subject,
            "message": message,
        },
        timeout=10,
    )

    response.raise_for_status()

    return response.json()