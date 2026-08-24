import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))


from app.tools.notification_tool import notification_tool


def main():
    result = notification_tool.invoke({
        "to": "nitinsingh.iitp@gmail.com",
        "subject": "RecoverAI NotificationTool Test",
        "message": "RecoverAI NotificationTool execution successful.",
    })

    print("NotificationTool execution successful.")
    print(f"Provider: {result['provider']}")
    print(f"Successful: {result['successful']}")
    print(f"Message ID: {result['messageId']}")


if __name__ == "__main__":
    main()