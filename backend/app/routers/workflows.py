from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import WorkflowExecution
from app.schemas import WorkflowOut

router = APIRouter(tags=["workflows"])


@router.get("/workflows", response_model=list[WorkflowOut])
def list_workflows(db: Session = Depends(get_db)):
    return list(db.scalars(select(WorkflowExecution).order_by(WorkflowExecution.started_at.desc())).all())