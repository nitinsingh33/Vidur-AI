import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from app.graph.workflow import build_recovery_graph

RECOVERY_CASE_ID = (
    "80738502-b206-4395-b4d6-c2e79f3f4c8e"
)


def main():
    graph = build_recovery_graph()

    result = graph.invoke(
        {
            "recovery_case_id": RECOVERY_CASE_ID,
            "attempt": 0,
        }
    )

    recovery_case = result["recovery_case"]

    print("Recovery workflow completed.")
    print(
        f"Recovery successful: "
        f"{result['success']}"
    )

    if result["success"]:
        print("Final decision: RECOVER")
    else:
        print("Final decision: ESCALATE")
    
if __name__ == "__main__":
    main()