from datetime import datetime

from pydantic import BaseModel, Field


class DoctorOut(BaseModel):
    doctor_id: str
    name: str
    specialty: str | None = None
    role: str = "Doctor"

    model_config = {"from_attributes": True}


class CreateAppointmentIn(BaseModel):
    patient_id: str
    doctor_id: str
    starts_at: datetime
    duration_minutes: int = Field(default=30, ge=10, le=180)
    visit_type: str = "Consultation"
    reason: str | None = None
    notes: str | None = None
    actor_name: str = "Staff"
    actor_role: str = "Receptionist"


class UpdateAppointmentIn(BaseModel):
    doctor_id: str | None = None
    starts_at: datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=10, le=180)
    visit_type: str | None = None
    reason: str | None = None
    notes: str | None = None
    status: str | None = None
    actor_name: str = "Staff"
    actor_role: str = "Receptionist"


class AppointmentOut(BaseModel):
    appointment_id: str
    patient_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    starts_at: datetime
    duration_minutes: int
    visit_type: str
    reason: str | None = None
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
