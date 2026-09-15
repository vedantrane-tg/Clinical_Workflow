import json
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Patient, Specialist

try:
    from google import genai
except ImportError:
    genai = None


TRIAGE_SYSTEM_PROMPT = """
You are a clinical triage AI assistant in a hospital front desk setting.
Given a patient's medical history (EHR) and their current chief complaint,
you must determine:

1. RECOMMENDED SPECIALTY: Which medical specialty should see this patient.
2. ACUITY LEVEL: How urgently the patient needs to be seen.
   - "Routine": Can wait, standard queue
   - "Urgent": Should be seen within the hour
   - "Emergency": Needs immediate attention
3. PRE-VISIT BRIEF: A concise 3-5 bullet clinical brief that helps the
   receiving doctor quickly understand the patient's relevant history
   in context of today's chief complaint.
4. RISK ASSESSMENT: Overall patient risk level ("Low", "Medium", "High")

Return ONLY a JSON object with keys:
  recommended_specialty (string),
  acuity_level (string: "Routine" | "Urgent" | "Emergency"),
  risk_level (string: "Low" | "Medium" | "High"),
  pre_visit_brief (string - markdown formatted, concise bullets),
  brief_sections (array of {heading, body}),
  reasoning (string - one sentence explaining the triage decision),
  confidence (float 0.0-1.0)
"""


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _patient_ehr_payload(patient: Patient) -> dict:
    return {
        "patient_id": patient.patient_id,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "risk": patient.risk,
        "conditions": patient.conditions or [],
        "medications": patient.medications or [],
        "labs": patient.labs or [],
        "encounters": patient.encounters or [],
    }


def _rule_based_triage(patient: Patient, chief_complaint: str) -> dict:
    text = chief_complaint.lower()
    specialty = "General Medicine"
    acuity = "Routine"
    risk = patient.risk or "Low"

    if any(k in text for k in ("chest pain", "breath", "heart", "palpitation")):
        specialty = "Cardiologist"
        acuity = "Urgent"
        risk = "High"
    elif any(k in text for k in ("sugar", "diabetes", "blurry", "neuropathy", "tingling", "hba1c")):
        specialty = "Endocrinologist"
        acuity = "Urgent"
        risk = "High"
    elif any(k in text for k in ("kidney", "creatinine", "swelling", "urine")):
        specialty = "Nephrologist"
        acuity = "Urgent"
        risk = "Medium"
    elif any(k in text for k in ("emergency", "unconscious", "severe pain", "bleeding")):
        acuity = "Emergency"
        risk = "High"

    conditions = ", ".join(
        c.get("name", "") for c in (patient.conditions or []) if isinstance(c, dict)
    ) or "None documented"

    brief = (
        f"- {patient.age}{patient.gender[0] if patient.gender else ''} presenting with: {chief_complaint}\n"
        f"- Known conditions: {conditions}\n"
        f"- Suggested specialty: {specialty} ({acuity})"
    )

    return {
        "recommended_specialty": specialty,
        "acuity_level": acuity,
        "risk_level": risk,
        "pre_visit_brief": brief,
        "brief_sections": [
            {"heading": "Chief Complaint", "body": chief_complaint},
            {"heading": "Known Conditions", "body": conditions},
            {"heading": "Triage Suggestion", "body": f"{specialty} — {acuity}"},
        ],
        "reasoning": f"Rule-based triage mapped complaint keywords to {specialty}.",
        "confidence": 0.55,
        "model": "rules-fallback",
    }


def _gemini_triage(patient: Patient, chief_complaint: str, vitals: dict | None) -> dict | None:
    settings = get_settings()
    if not settings.ai_enabled or genai is None:
        return None

    payload = {
        "ehr": _patient_ehr_payload(patient),
        "chief_complaint": chief_complaint,
        "vitals": vitals or {},
    }

    try:
        client = genai.Client(api_key=settings.google_api_key)
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=(
                f"{TRIAGE_SYSTEM_PROMPT}\n\n"
                f"Patient data:\n{json.dumps(payload, default=str)}\n\n"
                "Return ONLY the JSON object."
            ),
        )
        raw = _strip_fences(response.text or "")
        data = json.loads(raw)
        required = {
            "recommended_specialty",
            "acuity_level",
            "risk_level",
            "pre_visit_brief",
            "brief_sections",
            "reasoning",
            "confidence",
        }
        if not required.issubset(data.keys()):
            return None
        data["model"] = f"{settings.gemini_model} (Gemini)"
        return data
    except Exception:
        return None


def assign_doctor(db: Session, specialty: str) -> Specialist | None:
    """Pick least-loaded available specialist matching specialty (fuzzy contains)."""
    specialists = list(db.scalars(select(Specialist)).all())
    specialty_l = specialty.lower()

    matches = [
        s
        for s in specialists
        if specialty_l in s.specialty.lower()
        or s.specialty.lower() in specialty_l
        or specialty_l.replace("ist", "") in s.specialty.lower()
    ]
    if not matches:
        # fallback: any available
        matches = [s for s in specialists if s.availability != "Unavailable"]

    matches = [s for s in matches if s.availability != "Unavailable"]
    if not matches:
        return None

    matches.sort(key=lambda s: s.active_referrals)
    return matches[0]


def run_triage_agent(
    db: Session,
    *,
    patient: Patient,
    chief_complaint: str,
    vitals: dict | None = None,
) -> dict:
    """
    Returns triage dict including optional assigned doctor fields:
      recommended_doctor_id, recommended_doctor_name
    """
    result = _gemini_triage(patient, chief_complaint, vitals)
    if result is None:
        result = _rule_based_triage(patient, chief_complaint)

    doctor = assign_doctor(db, result["recommended_specialty"])
    result["recommended_doctor_id"] = doctor.specialist_id if doctor else None
    result["recommended_doctor_name"] = doctor.name if doctor else None
    return result