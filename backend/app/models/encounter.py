from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class Encounter(Base):
    __tablename__ = "encounters"

    encounter_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    patient_id: Mapped[str] = mapped_column(String(32), nullable=False)
    consultation_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    triage_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    doctor_id: Mapped[str] = mapped_column(String(32), nullable=False)
    doctor_name: Mapped[str] = mapped_column(String(120), nullable=False)

    # SOAP (Agent 2)
    soap_subjective: Mapped[str | None] = mapped_column(Text, nullable=True)
    soap_objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    soap_assessment: Mapped[str | None] = mapped_column(Text, nullable=True)
    soap_plan: Mapped[str | None] = mapped_column(Text, nullable=True)

    # CDS suggestions (Agent 3)
    suggested_labs: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    suggested_medications: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    suggested_icd_codes: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    suggested_referrals: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Doctor approvals
    approved_labs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    approved_medications: Mapped[list | None] = mapped_column(JSON, nullable=True)
    approved_icd_codes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    approved_referrals: Mapped[list | None] = mapped_column(JSON, nullable=True)
    prescription: Mapped[list | None] = mapped_column(JSON, nullable=True)
    prescription_pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="In Progress")
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finalized_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)