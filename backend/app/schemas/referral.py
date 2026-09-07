from datetime import datetime

from pydantic import BaseModel, ConfigDict


class Actor(BaseModel):
    name: str
    role: str  # "Clinician" or "Care Coordinator"


class CreateReferralIn(BaseModel):
    patient_id: str
    issue: str
    specialist_type: str
    specialist_id: str
    priority: str
    notes: str = ""
    actor: Actor


class ReferralOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    referral_id: str
    patient_id: str
    patient_name: str
    issue: str
    specialist_type: str
    specialist_id: str | None
    specialist_name: str | None
    priority: str
    status: str
    created_at: datetime
    agent_notes: str
    created_by: str


class UpdateReferralIn(BaseModel):
    status: str | None = None
    specialist_id: str | None = None
    specialist_name: str | None = None
    priority: str | None = None
    agent_notes: str | None = None
    actor: Actor