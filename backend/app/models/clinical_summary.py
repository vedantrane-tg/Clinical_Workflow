from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class ClinicalSummary(Base):
    __tablename__ = "clinical_summaries"

    patient_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    sections: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    concerns: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    abnormal_labs: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    medication_conflicts: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    recommended_actions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    issues: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    generated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    model: Mapped[str] = mapped_column(String(64), nullable=False)