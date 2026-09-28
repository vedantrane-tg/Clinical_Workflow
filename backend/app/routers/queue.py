from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, Payment, Specialist
from app.schemas import DoctorQueueOut, QueuePatientOut
from app.services.fees import VISIT_PAYMENT_TYPES, _as_naive_utc

router = APIRouter(prefix="/queue", tags=["queue"])


def _visit_paid_ids(db: Session, patients: list[Patient]) -> set[str]:
    """Patients with a completed visit payment at or after this check-in."""
    ids = [p.patient_id for p in patients if p.checked_in_at]
    if not ids:
        return set()

    payments = list(
        db.scalars(
            select(Payment).where(
                Payment.patient_id.in_(ids),
                Payment.status == "Completed",
                Payment.payment_type.in_(VISIT_PAYMENT_TYPES),
            )
        ).all()
    )
    by_patient: dict[str, list[Payment]] = {}
    for payment in payments:
        by_patient.setdefault(payment.patient_id, []).append(payment)

    paid: set[str] = set()
    for patient in patients:
        if not patient.checked_in_at:
            continue
        checkin = _as_naive_utc(patient.checked_in_at)
        for payment in by_patient.get(patient.patient_id, []):
            paid_at = _as_naive_utc(payment.completed_at or payment.created_at)
            if paid_at >= checkin:
                paid.add(patient.patient_id)
                break
    return paid


def _to_queue_patient(p: Patient, *, visit_paid: bool) -> QueuePatientOut:
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
        visit_paid=visit_paid,
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
    paid = _visit_paid_ids(db, patients)
    return [_to_queue_patient(p, visit_paid=p.patient_id in paid) for p in patients]


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
        paid = _visit_paid_ids(db, patients)
        result.append(
            DoctorQueueOut(
                doctor_id=doctor.specialist_id,
                doctor_name=doctor.name,
                specialty=doctor.specialty,
                patients=[
                    _to_queue_patient(p, visit_paid=p.patient_id in paid) for p in patients
                ],
            )
        )
    return result