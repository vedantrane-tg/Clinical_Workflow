from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditEntry
from app.schemas.audit import AuditOut

router = APIRouter(tags=["audit"])


@router.get("/audit", response_model=list[AuditOut])
def list_audit(db: Session = Depends(get_db)):
    return list(db.scalars(select(AuditEntry).order_by(AuditEntry.timestamp.desc())).all())