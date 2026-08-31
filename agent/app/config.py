from pathlib import Path

from dotenv import load_dotenv
import os

AGENT_ROOT = Path(__file__).resolve().parents[1]

load_dotenv(AGENT_ROOT / ".env")

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:3000")
ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://localhost:8001")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
# Text-to-speech-capable Gemini model used only for the Hinglish voice
# message channel (see app/llm/voice_message.py). Independent from
# GEMINI_MODEL since not every Gemini model supports audio output.
GEMINI_TTS_MODEL = os.environ.get(
    "GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts"
)

# Shared secret presented to the NestJS backend's agent-facing endpoints
# (recovery cases, policy checks, escalation) in the x-agent-token header.
# Must match AGENT_SERVICE_TOKEN in backend/.env exactly.
AGENT_SERVICE_TOKEN = os.environ.get("AGENT_SERVICE_TOKEN")
