import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from app.graph.workflow import build_recovery_graph


RECOVERY_CASE_ID = (
    "e2137214-1123-4ba2-9310-bbe8e9a9bf51"
)


def main():
    graph = build_recovery_graph()

    result = graph.invoke(
        {
            "recovery_case_id": RECOVERY_CASE_ID,
            "attempt": 0,
        }
    )

    print("Policy routing completed.")
    print(
        f"Candidate intervention: "
        f"{result['candidate_intervention']}"
    )
    print(
        f"Policy decision: "
        f"{result['policy_decision']}"
    )

    if result["policy_decision"] == "ALLOW":
        print("Policy branch: EXECUTE")
    else:
        print("Policy branch: ESCALATE")


if __name__ == "__main__":
    main()