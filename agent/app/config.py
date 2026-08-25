from pathlib import Path

from dotenv import load_dotenv
import os

AGENT_ROOT = Path(__file__).resolve().parents[1]

load_dotenv(AGENT_ROOT / ".env")

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")
ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://localhost:8001")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
