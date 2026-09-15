from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, TriageResult
from app.schemas import CheckinRequest, TriageResultOut
from app.services.agents.triage_agent import run_triage_agent
from app.services.ids import next_triage_id, utcnow, write_audit

router = APIRouter(tags=["triage"])


@router.post("/patients/{patient_id}/checkin", response_model=TriageResultOut)
def checkin_patient(
    patient_id: str,
    body: CheckinRequest,
    db: Session = Depends(get_db),
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")

    triage_data = run_triage_agent(
        db,
        patient=patient,
        chief_complaint=body.chief_complaint.strip(),
        vitals=body.vitals,
    )

    # Queue position = count already waiting for this doctor + 1
    doctor_id = triage_data.get("recommended_doctor_id")
    queue_position = None
    if doctor_id:
        waiting_count = db.scalar(
            select(func.count())
            .select_from(Patient)
            .where(
                Patient.assigned_doctor_id == doctor_id,
                Patient.queue_status == "Waiting",
            )
        ) or 0
        queue_position = int(waiting_count) + 1

    patient.chief_complaint = body.chief_complaint.strip()
    patient.checked_in_at = utcnow()
    patient.queue_status = "Waiting"
    patient.assigned_doctor_id = doctor_id
    patient.queue_position = queue_position
    patient.risk = triage_data.get("risk_level") or patient.risk
    patient.workflow_status = "Triaged"

    triage = TriageResult(
        triage_id=next_triage_id(db),
        patient_id=patient.patient_id,
        chief_complaint=body.chief_complaint.strip(),
        recommended_specialty=triage_data["recommended_specialty"],
        recommended_doctor_id=triage_data.get("recommended_doctor_id"),
        recommended_doctor_name=triage_data.get("recommended_doctor_name"),
        acuity_level=triage_data["acuity_level"],
        pre_visit_brief=triage_data["pre_visit_brief"],
        brief_sections=triage_data.get("brief_sections") or [],
        confidence_score=float(triage_data.get("confidence") or 0.0),
        model=triage_data.get("model") or "unknown",
        created_at=utcnow(),
    )
    db.add(triage)

    write_audit(
        db,
        user=body.actor_name,
        role=body.actor_role,
        action=(
            f"Triage completed for {patient.patient_id}: "
            f"{triage.recommended_specialty} / {triage.acuity_level}"
        ),
        patient_id=patient.patient_id,
        agent="Agent1-Triage",
    )

    db.commit()
    db.refresh(triage)
    return triage