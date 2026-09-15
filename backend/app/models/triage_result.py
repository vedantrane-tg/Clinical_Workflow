from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class TriageResult(Base):
    __tablename__ = "triage_results"

    triage_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    patient_id: Mapped[str] = mapped_column(String(32), nullable=False)
    chief_complaint: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_specialty: Mapped[str] = mapped_column(String(64), nullable=False)
    recommended_doctor_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    recommended_doctor_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    acuity_level: Mapped[str] = mapped_column(String(32), nullable=False)  # Routine | Urgent | Emergency
    pre_visit_brief: Mapped[str] = mapped_column(Text, nullable=False)
    brief_sections: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    model: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)