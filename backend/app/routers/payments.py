import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Patient, Payment
from app.schemas import CreatePaymentIn, PaymentOut
from app.services.ids import next_payment_id, utcnow, write_audit

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("", response_model=PaymentOut, status_code=201)
def create_payment(body: CreatePaymentIn, db: Session = Depends(get_db)):
    patient = db.get(Patient, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {body.patient_id} not found")

    if body.payment_method not in ("Cash", "Card", "UPI", "Insurance"):
        raise HTTPException(status_code=400, detail="Invalid payment_method")

    if body.payment_type not in ("Consultation", "Follow-up", "Lab", "Procedure"):
        raise HTTPException(status_code=400, detail="Invalid payment_type")

    # Mock gateway delay
    time.sleep(0.5)

    now = utcnow()
    payment = Payment(
        payment_id=next_payment_id(db),
        patient_id=body.patient_id,
        encounter_id=body.encounter_id,
        amount=body.amount,
        currency="INR",
        payment_type=body.payment_type,
        payment_method=body.payment_method,
        status="Completed",
        transaction_ref=str(uuid.uuid4()),
        created_at=now,
        completed_at=now,
    )
    db.add(payment)

    write_audit(
        db,
        user=body.actor_name,
        role=body.actor_role,
        action=(
            f"Payment {payment.payment_id} completed: "
            f"₹{payment.amount} via {payment.payment_method}"
        ),
        patient_id=body.patient_id,
    )

    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment {payment_id} not found")
    return payment