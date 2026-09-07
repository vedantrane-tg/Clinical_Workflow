from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Specialist(Base):
    __tablename__ = "specialists"

    specialist_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    specialty: Mapped[str] = mapped_column(String(48), nullable=False)
    facility: Mapped[str] = mapped_column(String(160), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    availability: Mapped[str] = mapped_column(String(32), nullable=False)
    active_referrals: Mapped[int] = mapped_column(Integer, nullable=False, default=0)