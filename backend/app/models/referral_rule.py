from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.database import Base


class ReferralRule(Base):
    __tablename__ = "referral_rules"

    rule_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    condition: Mapped[str] = mapped_column(String(160), nullable=False)
    trigger: Mapped[str] = mapped_column(String(160), nullable=False)
    expression: Mapped[dict] = mapped_column(JSON, nullable=False)
    specialist: Mapped[str] = mapped_column(String(48), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)