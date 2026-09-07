from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class Patient(Base):
    __tablename__ = "patients"

    patient_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
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