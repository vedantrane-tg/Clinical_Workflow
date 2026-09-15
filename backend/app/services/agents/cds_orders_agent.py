import json
import re

from app.config import get_settings
from app.models import Patient

try:
    from google import genai
except ImportError:
    genai = None


CDS_SYSTEM_PROMPT = """
You are a Clinical Decision Support (CDS) AI assistant.
Given a SOAP note from a doctor-patient consultation and the patient's
medical profile (conditions, medications, labs), suggest:

1. DIAGNOSTIC TESTS: Lab tests and imaging studies to order.
2. MEDICATIONS: Prescriptions with dose, frequency, route, and reason.
3. ICD-10 CODES: Relevant diagnostic codes for billing.
4. FOLLOW-UP: Follow-up timeline and any specialist referrals needed.

Rules:
- Base suggestions ONLY on the SOAP note and patient data provided.
- Cite clinical reasoning for each suggestion.
- Flag any potential drug interactions with current medications.
- Prioritize suggestions as "Required", "Recommended", or "Optional".

Return ONLY a JSON object:
{
  "suggested_labs": [
    {"test": "HbA1c", "reason": "Monitor glycemic control", "priority": "Required"}
  ],
  "suggested_medications": [
    {"name": "Metformin", "dose": "500mg", "frequency": "BID", "route": "Oral",
     "reason": "Glycemic control", "interactions": []}
  ],
  "suggested_icd_codes": [
    {"code": "E11.319", "description": "Type 2 DM with unspecified diabetic retinopathy"}
  ],
  "suggested_referrals": [
    {"specialty": "Ophthalmology", "reason": "Diabetic retinopathy screening", "urgency": "Urgent"}
  ],
  "warnings": ["Check renal function before continuing Metformin"],
  "follow_up": "Schedule follow-up in 2 weeks for lab review"
}
"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _fallback_cds(patient: Patient, soap_note: dict) -> dict:
    conditions = patient.conditions or []
    first = conditions[0].get("name") if conditions and isinstance(conditions[0], dict) else "General symptoms"
    return {
        "suggested_labs": [
            {"test": "CBC", "reason": "Baseline workup", "priority": "Recommended"},
            {"test": "CMP", "reason": "Metabolic assessment", "priority": "Recommended"},
        ],
        "suggested_medications": [],
        "suggested_icd_codes": [
            {"code": "R50.9", "description": "Fever, unspecified"},
        ],
        "suggested_referrals": [],
        "warnings": [],
        "follow_up": "Follow up in 1 week or sooner if symptoms worsen",
        "model": "rules-fallback",
        "_context_note": first,
        "_soap_assessment": (soap_note or {}).get("assessment"),
    }


def run_cds_agent(*, patient: Patient, soap_note: dict) -> dict:
    settings = get_settings()
    payload = {
        "patient": {
            "patient_id": patient.patient_id,
            "age": patient.age,
            "gender": patient.gender,
            "conditions": patient.conditions or [],
            "medications": patient.medications or [],
            "labs": patient.labs or [],
            "chief_complaint": patient.chief_complaint,
        },
        "soap_note": soap_note or {},
    }

    if not settings.ai_enabled or genai is None:
        return _fallback_cds(patient, soap_note)

    try:
        client = genai.Client(api_key=settings.google_api_key)
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=(
                f"{CDS_SYSTEM_PROMPT}\n\n"
                f"Input:\n{json.dumps(payload, default=str)}\n\n"
                "Return ONLY the JSON object."
            ),
        )
        raw = _strip_fences(response.text or "")
        data = json.loads(raw)
        required = {
            "suggested_labs",
            "suggested_medications",
            "suggested_icd_codes",
            "suggested_referrals",
        }
        if not required.issubset(data.keys()):
            return _fallback_cds(patient, soap_note)
        data.setdefault("warnings", [])
        data.setdefault("follow_up", "")
        data["model"] = f"{settings.gemini_model} (Gemini)"
        return data
    except Exception as e:
        print(f"CDS error: {type(e).__name__}: {e}")
        return _fallback_cds(patient, soap_note)