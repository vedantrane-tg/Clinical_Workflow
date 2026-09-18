import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ClinicalSummary, ExtractedEHR, Patient

from datetime import date
from app.schemas import (
    ClinicalSummaryOut,
    CreatePatientIn,
    ExtractedEHROut,
    PatientOut,
    RunWorkflowIn,
    WorkflowOut,
)

from app.services.ids import next_patient_id, write_audit, utcnow
from app.services.workflow import run_patient_workflow, run_patient_workflow_streaming

router = APIRouter(tags=["patients"])
def _age_from_dob(date_of_birth: str) -> int:
    dob = date.fromisoformat(date_of_birth)
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

@router.get("/patients", response_model=list[PatientOut])
def list_patients(db: Session = Depends(get_db)):
    return list(db.scalars(select(Patient).order_by(Patient.patient_id)).all())


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return patient

@router.post("/patients", response_model=PatientOut, status_code=201)
def create_patient(body: CreatePatientIn, db: Session = Depends(get_db)):
    # Field formats are validated by CreatePatientIn; age is derived from DOB.
    age = _age_from_dob(body.date_of_birth)

    patient = Patient(
        patient_id=next_patient_id(db),
        name=body.full_name,
        first_name=body.first_name,
        middle_name=body.middle_name,
        last_name=body.last_name,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        age=age,
        risk="Low",
        conditions=body.conditions or [],
        medications=body.medications or [],
        encounters=[],
        labs=[],
        workflow_status="Not Started",
        last_encounter="",
        issues_count=0,
        referrals_count=0,
        chief_complaint=None,
        assigned_doctor_id=None,
        queue_status="Not Checked In",
        queue_position=None,
        checked_in_at=None,
        contact_phone=body.contact_phone,
        contact_email=body.contact_email,
        insurance_id=body.insurance_id,
        address=body.address,
        pincode=body.pincode,
        guardian_name=body.guardian_name,
        guardian_relationship=body.guardian_relationship,
        guardian_phone=body.guardian_phone,
        guardian_email=body.guardian_email,
    )
    db.add(patient)
    write_audit(
        db,
        user="Receptionist",
        role="Receptionist",
        action=f"Receptionist registered new patient {patient.patient_id}",
        patient_id=patient.patient_id,
    )
    db.commit()
    db.refresh(patient)
    return patient

@router.post("/patients/{patient_id}/workflow/run", response_model=WorkflowOut)
def run_workflow(patient_id: str, body: RunWorkflowIn, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    workflow = run_patient_workflow(
        db,
        patient=patient,
        actor_name=body.actor.name,
        actor_role=body.actor.role,
    )
    return workflow


@router.post("/patients/{patient_id}/workflow/stream")
def stream_workflow(patient_id: str, body: RunWorkflowIn, db: Session = Depends(get_db)):
    """SSE endpoint that streams workflow progress events step-by-step."""
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")

    def event_generator():
        gen = run_patient_workflow_streaming(
            db,
            patient=patient,
            actor_name=body.actor.name,
            actor_role=body.actor.role,
        )
        for snapshot in gen:
            data = json.dumps(snapshot, default=str)
            yield f"data: {data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/patients/{patient_id}/ehr", response_model=ExtractedEHROut | None)
def get_patient_ehr(patient_id: str, db: Session = Depends(get_db)):
    if not db.get(Patient, patient_id):
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return db.get(ExtractedEHR, patient_id)


@router.get("/patients/{patient_id}/summary", response_model=ClinicalSummaryOut | None)
def get_patient_summary(patient_id: str, db: Session = Depends(get_db)):
    if not db.get(Patient, patient_id):
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return db.get(ClinicalSummary, patient_id)