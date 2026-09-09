import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ClinicalSummary, ExtractedEHR, Patient
from app.schemas import (
    ClinicalSummaryOut,
    ExtractedEHROut,
    PatientOut,
    RunWorkflowIn,
    WorkflowOut,
)
from app.services.workflow import run_patient_workflow, run_patient_workflow_streaming

router = APIRouter(tags=["patients"])


@router.get("/patients", response_model=list[PatientOut])
def list_patients(db: Session = Depends(get_db)):
    return list(db.scalars(select(Patient).order_by(Patient.patient_id)).all())


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
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