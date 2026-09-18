from datetime import datetime
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON
from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    patient_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    middle_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(60), nullable=True)
    date_of_birth: Mapped[str] = mapped_column(String(32), nullable=False)
    gender: Mapped[str] = mapped_column(String(16), nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    risk: Mapped[str] = mapped_column(String(16), nullable=False)

    # Nested clinical data stored as JSON (simple for SQLite learning)
    conditions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    medications: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    encounters: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    labs: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    workflow_status: Mapped[str] = mapped_column(String(48), nullable=False, default="Not Started")
    last_encounter: Mapped[str] = mapped_column(String(32), nullable=False)
    issues_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    referrals_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # NEW — intake / queue fields
    chief_complaint: Mapped[str | None] = mapped_column(String(512), nullable=True)
    assigned_doctor_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    queue_status: Mapped[str] = mapped_column(String(32), nullable=False, default="Not Checked In")
    queue_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    insurance_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    address: Mapped[str | None] = mapped_column(String(512), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    guardian_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    guardian_relationship: Mapped[str | None] = mapped_column(String(64), nullable=True)
    guardian_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    guardian_email: Mapped[str | None] = mapped_column(String(255), nullable=True)