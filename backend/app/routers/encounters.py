from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Encounter, Patient, Referral, Specialist
from app.schemas import EncounterOut, FinalizeEncounterIn
from app.services.agents.triage_agent import assign_doctor
from app.services.ids import next_referral_id, utcnow, write_audit

router = APIRouter(tags=["encounters"])


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

    encounter.approved_labs = body.approved_labs
    encounter.approved_medications = body.approved_medications
    encounter.approved_icd_codes = body.approved_icd_codes
    encounter.approved_referrals = body.approved_referrals
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
        action=f"Encounter {encounter.encounter_id} finalized",
        patient_id=patient.patient_id,
        agent="Doctor-Signoff",
    )

    db.commit()
    db.refresh(encounter)
    return encounter