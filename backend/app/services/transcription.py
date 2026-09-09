from pathlib import Path

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


def transcribe_audio_file(audio_path: str) -> str | None:
    """
    Returns transcript text, or None if AI disabled / fails.
    """
    settings = get_settings()
    if not settings.ai_enabled:
        return None

    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    mime = MIME_BY_EXT.get(path.suffix.lower())
    if not mime:
        raise ValueError(f"Unsupported audio type: {path.suffix}")

    client = genai.Client(api_key=settings.google_api_key)
    audio_bytes = path.read_bytes()

    prompt = (
        "Transcribe this doctor-patient consultation audio.\n"
        "Return ONLY the plain transcript text.\n"
        "Do not add headings, markdown, or commentary.\n"
        "If speech is unclear, use [inaudible]."
    )

    try:
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
        print(f"Transcription error: {type(e).__name__}: {e}")
        return None

