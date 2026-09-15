from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CreatePatientIn(BaseModel):
    name: str = Field(min_length=1)
    date_of_birth: str  # "YYYY-MM-DD"
    gender: str  # "Male" | "Female" | "Other"
    contact_phone: str | None = None
    contact_email: str | None = None
    insurance_id: str | None = None
    address: str | None = None
    conditions: list[dict] = []
    medications: list[dict] = []


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_id: str
    name: str
    date_of_birth: str
    gender: str
    age: int
    risk: str
    conditions: list
    medications: list
    encounters: list
    labs: list
    workflow_status: str
    last_encounter: str
    issues_count: int
    referrals_count: int

    # New intake / queue fields
    chief_complaint: str | None = None
    assigned_doctor_id: str | None = None
    queue_status: str = "Not Checked In"
    queue_position: int | None = None
    checked_in_at: datetime | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    insurance_id: str | None = None
    address: str | None = None