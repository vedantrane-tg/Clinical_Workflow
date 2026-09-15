from datetime import datetime

from pydantic import BaseModel


class QueuePatientOut(BaseModel):
    patient_id: str
    name: str
    age: int
    gender: str
    chief_complaint: str | None = None
    assigned_doctor_id: str | None = None
    queue_status: str
    queue_position: int | None = None
    checked_in_at: datetime | None = None
    risk: str
    acuity_hint: str | None = None


class DoctorQueueOut(BaseModel):
    doctor_id: str
    doctor_name: str
    specialty: str
    patients: list[QueuePatientOut]