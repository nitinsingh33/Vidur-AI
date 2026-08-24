import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from app.graph.workflow import build_recovery_graph

RECOVERY_CASE_ID = (
    "77165de0-ecb1-44b8-a31e-301df389978d"
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

    print("Intervention selection successful.")
    print(
        f"Candidate intervention: "
        f"{result['candidate_intervention']}"
    )

if __name__ == "__main__":
    main()