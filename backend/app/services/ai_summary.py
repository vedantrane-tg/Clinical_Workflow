import json
import re

try:
    from google import genai
except ImportError:
    genai = None

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
    if not settings.ai_enabled or genai is None:
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
    except Exception as e:
        print(f"AI summary error: {type(e).__name__}: {e}")
        return None


def detect_medication_conflicts(medications: list[dict], labs: list[dict]) -> list[str]:
    """Identify potential clinical drug-drug or drug-lab conflicts."""
    names = [str(m.get("name", "")).lower() for m in medications if m.get("status") == "Active"]
    conflicts: list[str] = []

    # Metformin + elevated Creatinine
    creatinine_lab = next((l for l in labs if l.get("test") == "Creatinine"), None)
    if any("metformin" in n for n in names) and creatinine_lab:
        try:
            val = float(creatinine_lab.get("value", 0))
            if val > 1.5:
                conflicts.append(
                    "Metformin is currently active while creatinine is elevated — renal dosing review is indicated."
                )
        except (ValueError, TypeError):
            pass

    # Lisinopril + elevated Potassium
    potassium_lab = next((l for l in labs if l.get("test") == "Potassium"), None)
    if any("lisinopril" in n for n in names) and potassium_lab:
        try:
            val = float(potassium_lab.get("value", 0))
            if val > 5.1:
                conflicts.append(
                    "ACE inhibitor (lisinopril) active with hyperkalaemia — monitor potassium closely."
                )
        except (ValueError, TypeError):
            pass

    # Dual oral hypoglycaemics
    if any("glimepiride" in n for n in names) and any("metformin" in n for n in names):
        conflicts.append("Dual oral hypoglycaemic therapy — hypoglycaemia risk should be reviewed.")

    return conflicts


def build_rich_clinical_summary(patient, rules: list, issues: list[dict], ehr_for_ai: dict, rules_for_ai: list[dict]) -> dict:
    """
    Build a comprehensive, multi-section clinical summary.
    If Gemini AI is available and succeeds, overlays the AI-generated narrative.
    Otherwise, returns the detailed rules-based structured summary.
    """
    from app.services.ids import utcnow

    conditions = patient.conditions or []
    medications = patient.medications or []
    encounters = patient.encounters or []
    labs = patient.labs or []

    abnormal = [lab for lab in labs if lab.get("status") in {"HIGH", "LOW", "CRITICAL"}]
    condition_names = " and ".join(c.get("name", "") for c in conditions) or "no active chronic conditions"
    med_names = ", ".join(m.get("name", "").lower() for m in medications if m.get("status") == "Active")
    abnormal_text = ", ".join(f"{l.get('test')} at {l.get('value')}{l.get('unit', '')}" for l in abnormal)
    conflicts = detect_medication_conflicts(medications, labs)
    last_encounter = encounters[0] if encounters else None
    specialists = list(dict.fromkeys(i.get("recommended_specialist") for i in issues if i.get("recommended_specialist")))

    summary_text = (
        f"Patient has a documented history of {condition_names}. "
        + (
            f"Recent laboratory results demonstrate {abnormal_text}. "
            if abnormal
            else "Recent laboratory results are within reference ranges. "
        )
        + (f"Current medications include {med_names}. " if med_names else "No active medications recorded. ")
        + (
            "Findings indicate the need for specialist review based on configured referral rules."
            if issues
            else "No referral rule thresholds were met at this time."
        )
    )

    sections = [
        {
            "heading": "Patient Overview",
            "body": f"{patient.name}, {patient.age}-year-old {str(patient.gender).lower()} (DOB {patient.date_of_birth}), record {patient.patient_id}.",
        },
        {
            "heading": "Active Conditions",
            "body": "; ".join(f"{c.get('name')} ({c.get('code', 'N/A')}, onset {c.get('onsetDate', 'N/A')})" for c in conditions) or "None documented.",
        },
        {
            "heading": "Current Medications",
            "body": "; ".join(f"{m.get('name')} {m.get('dose', '')} {str(m.get('frequency', '')).lower()}".strip() for m in medications if m.get("status") == "Active") or "None documented.",
        },
        {
            "heading": "Recent Encounters",
            "body": (
                f"Most recent encounter {last_encounter.get('date')} — {last_encounter.get('type')} with {last_encounter.get('provider')} for {str(last_encounter.get('reason', '')).lower()}."
                if last_encounter
                else "No encounters documented."
            ),
        },
        {
            "heading": "Recent Laboratory Results",
            "body": (
                "; ".join(f"{l.get('test')} {l.get('value')}{l.get('unit', '')} ({l.get('status')}, ref {l.get('referenceRange')})" for l in abnormal)
                if abnormal
                else "All reported results within reference range."
            ),
        },
        {
            "heading": "Clinical Concerns",
            "body": (
                " ".join(f"{i.get('severity')} priority — {i.get('issue')} ({i.get('evidence')})." for i in issues)
                if issues
                else "No threshold-based concerns identified."
            ),
        },
        {
            "heading": "Recommended Referral Actions",
            "body": (
                " ".join(f"Specialist review by {s}." for s in specialists)
                if specialists
                else "No referral action recommended at this time."
            ),
        },
    ]

    base_concerns = [f"{i.get('issue')} — {i.get('evidence')}" for i in issues]
    base_actions = [f"Create {s} referral" for s in specialists]

    model_name = "rules-engine-v1"

    # Try Gemini AI enrichment
    ai_result = generate_ai_narrative(ehr_for_ai, rules_for_ai)
    if ai_result is not None:
        narrative = ai_result["narrative"]
        if narrative.get("summary"):
            summary_text = narrative["summary"]
        if narrative.get("sections"):
            sections = narrative["sections"]
        if narrative.get("concerns"):
            base_concerns = narrative["concerns"]
        if narrative.get("medication_conflicts"):
            conflicts = narrative["medication_conflicts"]
        if narrative.get("recommended_actions"):
            base_actions = narrative["recommended_actions"]
        model_name = ai_result["model"]

    return {
        "summary": summary_text,
        "sections": sections,
        "concerns": base_concerns,
        "abnormal_labs": abnormal,
        "medication_conflicts": conflicts,
        "recommended_actions": base_actions,
        "issues": issues,
        "generated_at": utcnow(),
        "model": model_name,
    }