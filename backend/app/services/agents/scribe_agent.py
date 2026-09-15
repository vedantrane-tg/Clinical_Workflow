import json
import re

from app.config import get_settings
from app.services.transcription import transcribe_audio_file

try:
    from google import genai
except ImportError:
    genai = None


SCRIBE_SYSTEM_PROMPT = """
You are a medical scribe AI. Given a transcript of a doctor-patient
consultation, structure it into a professional SOAP note.

SOAP Format:
- Subjective (S): Patient's reported symptoms, history of present
  illness, relevant past history mentioned in conversation.
- Objective (O): Any vitals, physical exam findings, or test results
  mentioned by the doctor during the visit.
- Assessment (A): Doctor's clinical impression, differential diagnosis,
  or working diagnosis discussed.
- Plan (P): Treatment plan, medications prescribed, tests ordered,
  follow-up instructions, referrals mentioned.

Rules:
- Use only information present in the transcript.
- Use professional medical terminology.
- If a section has no relevant data, write "Not discussed during this visit."
- Do NOT invent findings.

Return ONLY a JSON object:
{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "key_findings": ["finding1", "finding2"],
  "mentioned_diagnoses": ["diagnosis1"],
  "mentioned_medications": ["med1"]
}
"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _fallback_soap(transcript: str) -> dict:
    chunk = (transcript or "No transcript available.").strip()
    parts = [chunk[i : i + max(len(chunk) // 4, 1)] for i in range(0, len(chunk), max(len(chunk) // 4, 1))]
    while len(parts) < 4:
        parts.append("Not discussed during this visit.")
    return {
        "subjective": parts[0] or "Not discussed during this visit.",
        "objective": parts[1] or "Not discussed during this visit.",
        "assessment": parts[2] or "Not discussed during this visit.",
        "plan": parts[3] or "Not discussed during this visit.",
        "key_findings": [],
        "mentioned_diagnoses": [],
        "mentioned_medications": [],
        "model": "rules-fallback",
    }


def generate_soap_note(transcript: str) -> dict:
    settings = get_settings()
    if not transcript or not transcript.strip():
        return _fallback_soap("")

    if not settings.ai_enabled or genai is None:
        return _fallback_soap(transcript)

    try:
        client = genai.Client(api_key=settings.google_api_key)
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=(
                f"{SCRIBE_SYSTEM_PROMPT}\n\n"
                f"Transcript:\n{transcript}\n\n"
                "Return ONLY the JSON object."
            ),
        )
        raw = _strip_fences(response.text or "")
        data = json.loads(raw)
        required = {"subjective", "objective", "assessment", "plan"}
        if not required.issubset(data.keys()):
            return _fallback_soap(transcript)
        data.setdefault("key_findings", [])
        data.setdefault("mentioned_diagnoses", [])
        data.setdefault("mentioned_medications", [])
        data["model"] = f"{settings.gemini_model} (Gemini)"
        return data
    except Exception as e:
        print(f"SOAP generation error: {type(e).__name__}: {e}")
        return _fallback_soap(transcript)


def run_scribe_agent(audio_path: str, existing_transcript: str | None = None) -> dict:
    """
    Returns:
      {
        "transcript": str,
        "soap_note": dict,
      }
    """
    transcript = (existing_transcript or "").strip()
    if not transcript:
        transcript = transcribe_audio_file(audio_path) or ""
    soap_note = generate_soap_note(transcript)
    return {"transcript": transcript, "soap_note": soap_note}