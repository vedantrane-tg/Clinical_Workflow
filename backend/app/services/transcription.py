from pathlib import Path

from deepgram import DeepgramClient
from google import genai
from google.genai import types

from app.config import get_settings

MIME_BY_EXT = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".webm": "audio/webm",
    ".ogg": "audio/ogg",
}


def _transcribe_with_deepgram(audio_path: Path) -> str | None:
    settings = get_settings()
    if not settings.deepgram_enabled:
        return None

    try:
        client = DeepgramClient(api_key=settings.deepgram_api_key)
        audio_bytes = audio_path.read_bytes()

        response = client.listen.v1.media.transcribe_file(
            request=audio_bytes,
            model=settings.deepgram_model,
            smart_format=True,
        )

        # SDK response shape can vary slightly by version; handle common cases
        transcript = None
        if hasattr(response, "results"):
            channels = response.results.channels
            transcript = channels[0].alternatives[0].transcript
        elif isinstance(response, dict):
            transcript = (
                response.get("results", {})
                .get("channels", [{}])[0]
                .get("alternatives", [{}])[0]
                .get("transcript")
            )

        text = (transcript or "").strip()
        return text or None
    except Exception as e:
        print(f"Deepgram error: {type(e).__name__}: {e}")
        return None


def _transcribe_with_gemini(audio_path: Path, mime: str) -> str | None:
    settings = get_settings()
    if not settings.ai_enabled:
        return None

    try:
        client = genai.Client(api_key=settings.google_api_key)
        audio_bytes = audio_path.read_bytes()
        prompt = (
            "Transcribe this doctor-patient consultation audio.\n"
            "Return ONLY the plain transcript text.\n"
            "Do not add headings, markdown, or commentary.\n"
            "If speech is unclear, use [inaudible]."
        )
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                prompt,
                types.Part.from_bytes(data=audio_bytes, mime_type=mime),
            ],
        )
        text = (response.text or "").strip()
        return text or None
    except Exception as e:
        print(f"Gemini transcription error: {type(e).__name__}: {e}")
        return None


def transcribe_audio_file(audio_path: str) -> str | None:
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    mime = MIME_BY_EXT.get(path.suffix.lower())
    if not mime:
        raise ValueError(f"Unsupported audio type: {path.suffix}")

    # Prefer Deepgram, fallback to Gemini
    text = _transcribe_with_deepgram(path)
    if text:
        print("Transcription source: Deepgram")
        return text

    text = _transcribe_with_gemini(path, mime)
    if text:
        print("Transcription source: Gemini fallback")
        return text

    return None