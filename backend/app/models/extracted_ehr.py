from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class ExtractedEHR(Base):
    __tablename__ = "extracted_ehr"

    patient_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    demographics: Mapped[dict] = mapped_column(JSON, nullable=False)
    conditions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    medications: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    encounters: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    labs: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    extracted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)