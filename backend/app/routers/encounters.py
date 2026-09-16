from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Encounter, Patient, Referral, Specialist
from app.schemas import EncounterOut, FinalizeEncounterIn
from app.schemas.encounter import PrescriptionPdfIn
from app.services.agents.triage_agent import assign_doctor
from app.services.ids import next_referral_id, utcnow, write_audit
from app.services.pdf_report import build_prescription_pdf

router = APIRouter(tags=["encounters"])

PDF_DIR = Path(__file__).resolve().parents[2] / "uploads" / "prescriptions"
PDF_DIR.mkdir(parents=True, exist_ok=True)


def _prescription_dicts(items: list) -> list[dict]:
    result: list[dict] = []
    for index, item in enumerate(items, start=1):
        data = item.model_dump() if hasattr(item, "model_dump") else dict(item)
        if not data.get("drug_label"):
            data["drug_label"] = f"{data.get('drug_form', '')} {data.get('drug_name', '')}".strip()
        if not data.get("frequency"):
            data["frequency"] = (
                f"{data.get('morning', 0)} - {data.get('afternoon', 0)} - {data.get('night', 0)}"
            )
        if not data.get("instructions_text"):
            duration = f"{data.get('duration_value', 1)} {data.get('duration_unit', 'day(s)')}"
            instruction = (data.get("instruction") or "").strip()
            data["instructions_text"] = f"{duration}\n{instruction}".strip() if instruction else duration
        data["seq"] = data.get("seq") or index
        result.append(data)
    return result


def _write_prescription_pdf(
    *,
    encounter: Encounter,
    patient: Patient,
    items: list[dict],
    doctor_name: str,
) -> str:
    pdf_path = PDF_DIR / f"{encounter.encounter_id}-rx.pdf"
    return build_prescription_pdf(
        output_path=str(pdf_path),
        encounter_id=encounter.encounter_id,
        patient_id=patient.patient_id,
        patient_name=patient.name,
        doctor_name=doctor_name,
        items=items,
    )


@router.get("/encounters/{encounter_id}", response_model=EncounterOut)
def get_encounter(encounter_id: str, db: Session = Depends(get_db)):
    encounter = db.get(Encounter, encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail=f"Encounter {encounter_id} not found")
    return encounter


@router.get("/encounters", response_model=list[EncounterOut])
def list_encounters(db: Session = Depends(get_db)):
    return list(db.scalars(select(Encounter).order_by(Encounter.created_at.desc())).all())


@router.post("/encounters/{encounter_id}/finalize", response_model=EncounterOut)
def finalize_encounter(
    encounter_id: str,
    body: FinalizeEncounterIn,
    db: Session = Depends(get_db),
):
    encounter = db.get(Encounter, encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail=f"Encounter {encounter_id} not found")
    if encounter.status == "Finalized":
        raise HTTPException(status_code=400, detail="Encounter already finalized")

    patient = db.get(Patient, encounter.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {encounter.patient_id} not found")

    if not body.prescription:
        raise HTTPException(status_code=400, detail="Add at least one prescription item before finalizing")

    prescription_items = _prescription_dicts(body.prescription)

    encounter.approved_labs = body.approved_labs
    encounter.approved_medications = body.approved_medications or [
        {
            "name": item["drug_label"],
            "dose": item.get("strength") or "",
            "frequency": item.get("frequency"),
            "instructions": item.get("instructions_text"),
        }
        for item in prescription_items
    ]
    encounter.approved_icd_codes = body.approved_icd_codes
    encounter.approved_referrals = body.approved_referrals
    encounter.prescription = prescription_items
    encounter.prescription_pdf_path = _write_prescription_pdf(
        encounter=encounter,
        patient=patient,
        items=prescription_items,
        doctor_name=body.actor_name or encounter.doctor_name,
    )
    encounter.status = "Finalized"
    encounter.finalized_at = utcnow()
    encounter.finalized_by = body.actor_name

    # Create referral records for approved referrals
    for item in body.approved_referrals or []:
        specialty = item.get("specialty") or "General Medicine"
        reason = item.get("reason") or "Follow-up referral"
        urgency = item.get("urgency") or "Routine"
        priority = "High" if str(urgency).lower() in ("urgent", "emergency") else "Medium"

        specialist = assign_doctor(db, specialty)
        referral = Referral(
            referral_id=next_referral_id(db),
            patient_id=patient.patient_id,
            patient_name=patient.name,
            issue=reason,
            specialist_type=specialty,
            specialist_id=specialist.specialist_id if specialist else None,
            specialist_name=specialist.name if specialist else None,
            priority=priority,
            status="Created",
            created_at=utcnow(),
            agent_notes=body.doctor_notes or f"Created from encounter {encounter.encounter_id}",
            created_by=f"{body.actor_role} · {body.actor_name}",
        )
        db.add(referral)
        if specialist:
            specialist.active_referrals = (specialist.active_referrals or 0) + 1
        patient.referrals_count = (patient.referrals_count or 0) + 1

    patient.queue_status = "Completed"
    patient.workflow_status = "Completed"

    write_audit(
        db,
        user=body.actor_name,
        role=body.actor_role,
        action=f"Encounter {encounter.encounter_id} finalized with prescription PDF",
        patient_id=patient.patient_id,
        agent="Doctor-Signoff",
    )

    db.commit()
    db.refresh(encounter)
    return encounter


@router.post("/encounters/{encounter_id}/prescription/pdf")
def generate_prescription_pdf(
    encounter_id: str,
    body: PrescriptionPdfIn,
    db: Session = Depends(get_db),
):
    encounter = db.get(Encounter, encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail=f"Encounter {encounter_id} not found")
    patient = db.get(Patient, encounter.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {encounter.patient_id} not found")

    items = _prescription_dicts(body.prescription)
    pdf_path = _write_prescription_pdf(
        encounter=encounter,
        patient=patient,
        items=items,
        doctor_name=body.actor_name or encounter.doctor_name,
    )
    encounter.prescription = items
    encounter.prescription_pdf_path = pdf_path
    db.commit()

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"{encounter.encounter_id}-prescription.pdf",
    )


@router.get("/encounters/{encounter_id}/prescription/pdf")
def download_prescription_pdf(encounter_id: str, db: Session = Depends(get_db)):
    encounter = db.get(Encounter, encounter_id)
    if not encounter or not encounter.prescription_pdf_path:
        raise HTTPException(status_code=404, detail="Prescription PDF not found. Generate it first.")
    return FileResponse(
        path=encounter.prescription_pdf_path,
        media_type="application/pdf",
        filename=f"{encounter.encounter_id}-prescription.pdf",
    )
