import base64
import io
import wave
from typing import Any

from google import genai
from google.genai import types

from .. import config

_client = None

# Gemini TTS returns raw 16-bit PCM, mono, 24kHz — wrapped into a WAV
# container below so the audio is directly playable by a browser <audio>
# element without any additional decoding step on the frontend.
TTS_SAMPLE_RATE_HZ = 24000
TTS_SAMPLE_WIDTH_BYTES = 2
TTS_CHANNELS = 1


def _get_client() -> genai.Client:
    global _client

    if _client is not None:
        return _client

    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")

    _client = genai.Client(api_key=config.GEMINI_API_KEY)

    return _client


def _build_script_prompt(context: dict[str, Any]) -> str:
    return (
        "You are a warm, natural-sounding voice assistant for an Indian "
        "payments company. Write a short (2-3 sentence) Hinglish message — "
        "mixed Hindi and English, written in Latin script only (no "
        "Devanagari) — for a customer whose payment did not go through. "
        "Gently remind them and ask them to please complete the payment "
        "using the link already sent to them. Do not invent a link, phone "
        "number, or company name, do not mention that you are an AI, and do "
        "not repeat these instructions — return only the message itself.\n\n"
        f"Customer name: {context.get('customer_name') or 'customer'}\n"
        f"Payment amount: {context.get('payment_amount')}\n"
        f"Root cause: {context.get('root_cause')}\n"
    )


def _generate_script(context: dict[str, Any]) -> str | None:
    client = _get_client()

    response = client.models.generate_content(
        model=config.GEMINI_MODEL,
        contents=_build_script_prompt(context),
    )

    text = response.text

    return text.strip() if text else None


def _pcm_to_wav_base64(pcm_bytes: bytes) -> str:
    buffer = io.BytesIO()

    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(TTS_CHANNELS)
        wav_file.setsampwidth(TTS_SAMPLE_WIDTH_BYTES)
        wav_file.setframerate(TTS_SAMPLE_RATE_HZ)
        wav_file.writeframes(pcm_bytes)

    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _synthesize_audio(script: str) -> str | None:
    client = _get_client()

    response = client.models.generate_content(
        model=config.GEMINI_TTS_MODEL,
        contents=script,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Kore"
                    )
                )
            ),
        ),
    )

    candidates = response.candidates or []

    if not candidates or not candidates[0].content.parts:
        return None

    pcm_bytes = candidates[0].content.parts[0].inline_data.data

    if not pcm_bytes:
        return None

    return _pcm_to_wav_base64(pcm_bytes)


def generate_voice_message(context: dict[str, Any]) -> dict[str, str] | None:
    """
    Produces a real Hinglish voice message for one recovery case: a real
    Gemini-generated script, synthesized into real audio via a Gemini TTS
    model — never a placed phone call, never canned/pre-recorded audio.

    Deliberately best-effort in the same sense as generate_diagnosis: any
    failure here (missing key, model error, network issue) returns None
    rather than raising, so the caller (RecoveryService.sendVoiceMessage)
    can report this specific attempt as failed and let the normal
    retry/exhaustion accounting handle it — exactly like any other channel
    whose external call errors, never silently ignored and never fabricated.
    """
    try:
        script = _generate_script(context)

        if not script:
            return None

        audio_base64 = _synthesize_audio(script)

        if not audio_base64:
            return None

        return {
            "script": script,
            "audio_base64": audio_base64,
            "mime_type": "audio/wav",
        }
    except Exception as error:
        print(f"[llm] voice message generation failed: {error}")
        return None
