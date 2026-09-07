from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ExtractedEHROut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_id: str
    demographics: dict
    conditions: list
    medications: list
    encounters: list
    labs: list
    extracted_at: datetime
    source: str