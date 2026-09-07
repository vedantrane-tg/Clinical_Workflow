from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Specialist
from app.schemas import SpecialistOut

router = APIRouter(tags=["specialists"])


@router.get("/specialists", response_model=list[SpecialistOut])
def list_specialists(db: Session = Depends(get_db)):
    return list(db.scalars(select(Specialist).order_by(Specialist.specialist_id)).all())