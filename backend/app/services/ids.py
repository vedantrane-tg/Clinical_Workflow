from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Referral, AuditEntry
from app.models import WorkflowExecution


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def next_referral_id(db: Session) -> str:
    # Count existing + offset so IDs look like REF-3001, REF-3002, ...
    count = len(db.scalars(select(Referral)).all())
    return f"REF-{3001 + count}"



def next_audit_id(db: Session) -> str:
    count = len(db.scalars(select(AuditEntry)).all())
    return f"AUD-{str(count + 1).zfill(4)}"


def write_audit(
    db: Session,
    *,
    user: str,
    role: str,
    action: str,
    patient_id: str | None = None,
    agent: str | None = None,
    result: str = "Success",
) -> AuditEntry:
    entry = AuditEntry(
        audit_id=next_audit_id(db),
        user=user,
        role=role,
        action=action,
        patient_id=patient_id,
        agent=agent,
        timestamp=utcnow(),
        result=result,
    )
    db.add(entry)
    return entry


def next_workflow_id(db: Session) -> str:
    count = len(db.scalars(select(WorkflowExecution)).all())
    return f"WF-{5001 + count}"

def next_issue_id(db: Session) -> str:
    # Simple counter based on time/count — fine for demo
    # Or use a static offset:
    from app.models import ClinicalSummary

    total = 0
    for row in db.scalars(select(ClinicalSummary)).all():
        total += len(row.issues or [])
    return f"ISS-{1001 + total}"