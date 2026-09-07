from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ClinicalSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_id: str
    summary: str
    sections: list
    concerns: list
    abnormal_labs: list
    medication_conflicts: list
    recommended_actions: list
    issues: list
    generated_at: datetime
    model: str