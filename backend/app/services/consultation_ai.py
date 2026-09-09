import json
import re

from google import genai

from app.config import get_settings


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def generate_key_points(transcript: str) -> list[str] | None:
    settings = get_settings()
    if not settings.ai_enabled:
        return None

    client = genai.Client(api_key=settings.google_api_key)
    prompt = f"""
You are assisting a clinician after a patient visit.
From this consultation transcript, extract clear key points the doctor should remember.

Rules:
- Use only information present in the transcript
- Do not invent diagnoses
- Prefer symptoms, duration, red flags, and follow-up reminders
- Return ONLY a JSON object: {{"key_points": ["...", "..."]}}
- 5 to 10 short bullet-style points

Transcript:
{transcript}
"""

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        raw = _strip_fences(response.text or "")
        data = json.loads(raw)
        points = data.get("key_points")
        if not isinstance(points, list) or not points:
            return None
        return [str(p).strip() for p in points if str(p).strip()]
    except Exception as e:
        print(f"Key points error: {type(e).__name__}: {e}")
        return None