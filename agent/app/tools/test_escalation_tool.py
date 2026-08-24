import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from app.tools.escalation_tool import escalation_tool


RECOVERY_CASE_ID = (
    "80738502-b206-4395-b4d6-c2e79f3f4c8e"
)


def main():
    result = escalation_tool.invoke({
        "recovery_case_id": RECOVERY_CASE_ID,
        "reason": "EscalationTool independent verification.",
    })

    print("EscalationTool execution successful.")
    print(
        f"Recovery case: "
        f"{result['recoveryCaseId']}"
    )
    print(
        f"Status: "
        f"{result['status']}"
    )
    print(
        f"Action ID: "
        f"{result['actionId']}"
    )


if __name__ == "__main__":
    main()