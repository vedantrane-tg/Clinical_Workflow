from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConsultationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    consultation_id: str
    patient_id: str | None
    audio_filename: str
    status: str
    transcript: str | None = None
    key_points: list | None = None
    pdf_path: str | None = None
    created_at: datetime