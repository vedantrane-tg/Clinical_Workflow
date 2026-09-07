from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Referral(Base):
    __tablename__ = "referrals"

    referral_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    patient_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    patient_name: Mapped[str] = mapped_column(String(120), nullable=False)
    issue: Mapped[str] = mapped_column(Text, nullable=False)
    specialist_type: Mapped[str] = mapped_column(String(48), nullable=False)
    specialist_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    specialist_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="Created")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    agent_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by: Mapped[str] = mapped_column(String(160), nullable=False)