from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, Referral, Specialist
from app.schemas import CreateReferralIn, ReferralOut, UpdateReferralIn
from app.services.ids import next_referral_id, utcnow, write_audit

router = APIRouter(tags=["referrals"])


@router.get("/referrals", response_model=list[ReferralOut])
def list_referrals(db: Session = Depends(get_db)):
    return list(db.scalars(select(Referral).order_by(Referral.created_at.desc())).all())


@router.post("/referrals", response_model=ReferralOut, status_code=201)
def create_referral(body: CreateReferralIn, db: Session = Depends(get_db)):
    patient = db.get(Patient, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {body.patient_id} not found")

    specialist = db.get(Specialist, body.specialist_id)
    if not specialist:
        raise HTTPException(status_code=404, detail=f"Specialist {body.specialist_id} not found")

    referral = Referral(
        referral_id=next_referral_id(db),
        patient_id=patient.patient_id,
        patient_name=patient.name,
        issue=body.issue,
        specialist_type=body.specialist_type,
        specialist_id=specialist.specialist_id,
        specialist_name=specialist.name,
        priority=body.priority,
        status="Created",
        created_at=utcnow(),
        agent_notes=body.notes or f"Manually created by {body.actor.role} {body.actor.name}.",
        created_by=f"{body.actor.role} · {body.actor.name}",
    )
    db.add(referral)

    specialist.active_referrals += 1
    patient.referrals_count = (patient.referrals_count or 0) + 1


    write_audit(
        db,
        user=body.actor.name,
        role=body.actor.role,
        action=f"{body.actor.role} created referral {referral.referral_id}",
        patient_id=referral.patient_id,
        agent=referral.agent_notes,
        result="Success",
    )

    write_audit(
        db,
        user=body.actor.name,
        role=body.actor.role,
        action=f"{body.actor.role} updated referral {referral_id} ({', '.join(patch.keys()) or 'no fields'})",
        patient_id=referral.patient_id,
        result="Success",
    )
    
    db.commit()
    db.refresh(referral)
    return referral


@router.get("/referrals/{referral_id}", response_model=ReferralOut)
def get_referral(referral_id: str, db: Session = Depends(get_db)):
    referral = db.get(Referral, referral_id)
    if not referral:
        raise HTTPException(status_code=404, detail=f"Referral {referral_id} not found")
    return referral


@router.patch("/referrals/{referral_id}", response_model=ReferralOut)
def update_referral(referral_id: str, body: UpdateReferralIn, db: Session = Depends(get_db)):
    referral = db.get(Referral, referral_id)
    if not referral:
        raise HTTPException(status_code=404, detail=f"Referral {referral_id} not found")

    # Only apply fields that were sent (not None)
    patch = body.model_dump(exclude={"actor"}, exclude_none=True)
    for key, value in patch.items():
        setattr(referral, key, value)

    db.commit()
    db.refresh(referral)
    return referral