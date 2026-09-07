import json
import re

from google import genai

from app.config import get_settings

SYSTEM_PROMPT = """You are a clinical summarisation assistant supporting primary-care clinicians.
You are given a structured EHR extract (JSON) for a single synthetic patient plus the active referral rules.
Produce a concise, factual clinical summary. Rules:
- Use only the data provided; never invent findings, dates, or values.
- Cite concrete values with units when describing abnormal results.
- Use professional clinical language, no markdown.
- sections: 5-7 items with headings such as Patient Overview, Active Conditions, Current Medications,
  Recent Encounters, Recent Laboratory Results, Clinical Concerns, Recommended Referral Actions.
- medication_conflicts: real interaction or dosing risks implied by the data; empty array if none.
- recommended_actions: short imperative actions; empty array if none.
This output is decision support only, never a diagnosis.

Return ONLY a JSON object with keys:
summary (string),
sections (array of {heading, body}),
concerns (string array),
medication_conflicts (string array),
recommended_actions (string array).
"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def generate_ai_narrative(ehr: dict, rules: list[dict]) -> dict | None:
    """
    Returns:
      {
        "narrative": {...},
        "model": "gemini-2.5-flash (Gemini)"
      }
    or None if AI is disabled / fails (caller should fall back).
    """
    settings = get_settings()
    if not settings.ai_enabled:
        return None

    client = genai.Client(api_key=settings.google_api_key)
    prompt = (
        f"EHR extract:\n{json.dumps(ehr, default=str)}\n\n"
        f"Active referral rules:\n{json.dumps(rules, default=str)}\n\n"
        "Return ONLY the JSON object described in the system instructions."
    )

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=(
                f"{SYSTEM_PROMPT}\n\n"
                f"EHR extract:\n{json.dumps(ehr, default=str)}\n\n"
                f"Active referral rules:\n{json.dumps(rules, default=str)}\n\n"
                "Return ONLY the JSON object."
            ),
            # config={
            #     "system_instruction": SYSTEM_PROMPT,
            #     "response_mime_type": "application/json",
            # },
        )
        raw = _strip_fences(response.text or "")
        narrative = json.loads(raw)

        required = {"summary", "sections", "concerns", "medication_conflicts", "recommended_actions"}
        if not required.issubset(narrative.keys()):
            return None

        return {
            "narrative": narrative,
            "model": f"{settings.gemini_model} (Gemini)",
        }
    # except Exception:
    #     # Fail soft — workflow can use rules-engine fallback
    #     return None
    except Exception as e:
        print(f"AI summary error: {type(e).__name__}: {e}")
        return None