import requests
from langchain_core.tools import tool


NESTJS_URL = "http://localhost:3000"


@tool
def escalation_tool(
    recovery_case_id: str,
    reason: str,
) -> dict:
    """
    Escalate a recovery case through the NestJS
    escalation business layer.
    """

    response = requests.post(
        f"{NESTJS_URL}/escalation/cases/{recovery_case_id}",
        json={
            "reason": reason,
        },
        timeout=10,
    )

    response.raise_for_status()

    return response.json()