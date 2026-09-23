from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Appointment, Patient, User
from app.schemas.appointment import (
    AppointmentOut,
    CreateAppointmentIn,
    DoctorOut,
    UpdateAppointmentIn,
)
from app.services.ids import next_appointment_id, utcnow, write_audit

router = APIRouter(tags=["appointments"])

VALID_STATUSES = {"Scheduled", "Checked In", "Completed", "Cancelled", "No Show"}
VALID_VISIT_TYPES = {"Consultation", "Follow-up", "New Visit", "Procedure"}


def _doctor_or_404(db: Session, doctor_id: str) -> User:
    doctor = db.get(User, doctor_id)
    if not doctor or doctor.role != "Doctor" or not doctor.is_active:
        raise HTTPException(status_code=404, detail=f"Doctor {doctor_id} not found")
    return doctor


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid datetime: {value}") from exc


@router.get("/appointments/doctors", response_model=list[DoctorOut])
def list_doctors(db: Session = Depends(get_db)):
    rows = list(
        db.scalars(
            select(User)
            .where(User.role == "Doctor", User.is_active.is_(True))
            .order_by(User.full_name.asc())
        ).all()
    )
    return [
        DoctorOut(
            doctor_id=u.user_id,
            name=u.full_name,
            specialty=u.specialty,
            role=u.role,
        )
        for u in rows
    ]


@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(
    db: Session = Depends(get_db),
    from_dt: str | None = Query(default=None, alias="from"),
    to_dt: str | None = Query(default=None, alias="to"),
    doctor_id: str | None = None,
    status: str | None = None,
    patient_id: str | None = None,
):
    start = _parse_dt(from_dt)
    end = _parse_dt(to_dt)
    stmt = select(Appointment)
    if start is not None:
        stmt = stmt.where(Appointment.starts_at >= start.replace(tzinfo=None))
    if end is not None:
        stmt = stmt.where(Appointment.starts_at < end.replace(tzinfo=None))
    if doctor_id:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if status:
        stmt = stmt.where(Appointment.status == status)
    if patient_id:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    stmt = stmt.order_by(Appointment.starts_at.asc())
    return list(db.scalars(stmt).all())


@router.post("/appointments", response_model=AppointmentOut, status_code=201)
def create_appointment(body: CreateAppointmentIn, db: Session = Depends(get_db)):
    patient = db.get(Patient, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {body.patient_id} not found")

    doctor = _doctor_or_404(db, body.doctor_id)
    visit_type = body.visit_type if body.visit_type in VALID_VISIT_TYPES else "Consultation"
    starts = body.starts_at.replace(tzinfo=None)
    now = utcnow().replace(tzinfo=None)
    if starts < now:
        raise HTTPException(
            status_code=400,
            detail="Cannot book an appointment in the past. Choose today or a future date and time.",
        )

    row = Appointment(
        appointment_id=next_appointment_id(db),
        patient_id=patient.patient_id,
        patient_name=patient.name,
        doctor_id=doctor.user_id,
        doctor_name=doctor.full_name,
        starts_at=starts,
        duration_minutes=body.duration_minutes,
        visit_type=visit_type,
        reason=body.reason,
        status="Scheduled",
        notes=body.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    write_audit(
        db,
        user=body.actor_name,
        role=body.actor_role,
        action=f"Booked appointment {row.appointment_id} for {patient.patient_id}",
        patient_id=patient.patient_id,
        agent=None,
    )
    db.commit()
    db.refresh(row)
    return row


@router.get("/appointments/{appointment_id}", response_model=AppointmentOut)
def get_appointment(appointment_id: str, db: Session = Depends(get_db)):
    row = db.get(Appointment, appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Appointment {appointment_id} not found")
    return row


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: str,
    body: UpdateAppointmentIn,
    db: Session = Depends(get_db),
):
    row = db.get(Appointment, appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Appointment {appointment_id} not found")

    if body.doctor_id is not None:
        doctor = _doctor_or_404(db, body.doctor_id)
        row.doctor_id = doctor.user_id
        row.doctor_name = doctor.full_name
    if body.starts_at is not None:
        new_starts = body.starts_at.replace(tzinfo=None)
        now = utcnow().replace(tzinfo=None)
        if new_starts < now:
            raise HTTPException(
                status_code=400,
                detail="Cannot move an appointment to the past. Choose today or a future date and time.",
            )
        row.starts_at = new_starts
    if body.duration_minutes is not None:
        row.duration_minutes = body.duration_minutes
    if body.visit_type is not None:
        if body.visit_type not in VALID_VISIT_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid visit_type: {body.visit_type}")
        row.visit_type = body.visit_type
    if body.reason is not None:
        row.reason = body.reason
    if body.notes is not None:
        row.notes = body.notes
    if body.status is not None:
        if body.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")
        row.status = body.status

    row.updated_at = utcnow().replace(tzinfo=None)
    write_audit(
        db,
        user=body.actor_name,
        role=body.actor_role,
        action=f"Updated appointment {row.appointment_id} → {row.status}",
        patient_id=row.patient_id,
        agent=None,
    )
    db.commit()
    db.refresh(row)
    return row


@router.delete("/appointments/{appointment_id}", status_code=204)
def delete_appointment(
    appointment_id: str,
    db: Session = Depends(get_db),
    actor_name: str = Query(default="Staff"),
    actor_role: str = Query(default="Receptionist"),
):
    row = db.get(Appointment, appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Appointment {appointment_id} not found")
    patient_id = row.patient_id
    db.delete(row)
    write_audit(
        db,
        user=actor_name,
        role=actor_role,
        action=f"Deleted appointment {appointment_id}",
        patient_id=patient_id,
        agent=None,
    )
    db.commit()
    return None
