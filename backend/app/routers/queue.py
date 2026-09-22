from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, Specialist
from app.schemas import DoctorQueueOut, QueuePatientOut

router = APIRouter(prefix="/queue", tags=["queue"])


def _to_queue_patient(p: Patient) -> QueuePatientOut:
    return QueuePatientOut(
        patient_id=p.patient_id,
        name=p.name,
        age=p.age,
        gender=p.gender,
        chief_complaint=p.chief_complaint,
        assigned_doctor_id=p.assigned_doctor_id,
        queue_status=p.queue_status,
        queue_position=p.queue_position,
        checked_in_at=p.checked_in_at,
        risk=p.risk,
        contact_phone=p.contact_phone,
    )


@router.get("", response_model=list[QueuePatientOut])
def get_doctor_queue(
    doctor_id: str = Query(..., description="Specialist/doctor id, e.g. SPC-2001"),
    db: Session = Depends(get_db),
):
    doctor = db.get(Specialist, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail=f"Doctor {doctor_id} not found")

    patients = list(
        db.scalars(
            select(Patient)
            .where(
                Patient.assigned_doctor_id == doctor_id,
                Patient.queue_status.in_(["Waiting", "In Consultation"]),
            )
            .order_by(Patient.queue_position.asc().nulls_last())
        ).all()
    )
    return [_to_queue_patient(p) for p in patients]


@router.get("/all", response_model=list[DoctorQueueOut])
def get_all_queues(db: Session = Depends(get_db)):
    doctors = list(db.scalars(select(Specialist).order_by(Specialist.specialist_id)).all())
    result: list[DoctorQueueOut] = []

    for doctor in doctors:
        patients = list(
            db.scalars(
                select(Patient)
                .where(
                    Patient.assigned_doctor_id == doctor.specialist_id,
                    Patient.queue_status.in_(["Waiting", "In Consultation"]),
                )
                .order_by(Patient.queue_position.asc().nulls_last())
            ).all()
        )
        result.append(
            DoctorQueueOut(
                doctor_id=doctor.specialist_id,
                doctor_name=doctor.name,
                specialty=doctor.specialty,
                patients=[_to_queue_patient(p) for p in patients],
            )
        )
    return result