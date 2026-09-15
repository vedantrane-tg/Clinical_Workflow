from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CheckinRequest(BaseModel):
    chief_complaint: str = Field(min_length=3)
    vitals: dict | None = None
    actor_name: str = "Receptionist"
    actor_role: str = "Receptionist"


class TriageResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    triage_id: str
    patient_id: str
    chief_complaint: str
    recommended_specialty: str
    recommended_doctor_id: str | None = None
    recommended_doctor_name: str | None = None
    acuity_level: str
    pre_visit_brief: str
    brief_sections: list
    confidence_score: float
    model: str
    created_at: datetime