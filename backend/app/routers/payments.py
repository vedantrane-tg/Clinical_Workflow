import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Patient, Payment
from app.schemas import CreatePaymentIn, PaymentOut
from app.schemas.payment import (
    CreateRazorpayOrderIn,
    RazorpayConfigOut,
    RazorpayOrderOut,
    VerifyRazorpayPaymentIn,
)
from app.services.ids import next_payment_id, utcnow, write_audit
from app.services.razorpay_service import (
    amount_to_paise,
    create_razorpay_order,
    verify_payment_signature,
    verify_webhook_signature,
)

router = APIRouter(tags=["payments"])

MANUAL_METHODS = {"Cash", "Insurance"}
RAZORPAY_METHODS = {"Card", "UPI"}


@router.get("/payments/razorpay/config", response_model=RazorpayConfigOut)
def razorpay_config():
    settings = get_settings()
    return RazorpayConfigOut(
        enabled=settings.razorpay_enabled,
        key_id=settings.razorpay_key_id if settings.razorpay_enabled else None,
    )


@router.post("/payments", response_model=PaymentOut, status_code=201)
def create_payment(body: CreatePaymentIn, db: Session = Depends(get_db)):
    """Record an offline/manual payment (Cash or Insurance). Card/UPI use Razorpay endpoints."""
    patient = db.get(Patient, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {body.patient_id} not found")

    if body.payment_method not in MANUAL_METHODS:
        raise HTTPException(
            status_code=400,
            detail="Card/UPI must use /payments/razorpay/order. Use Cash or Insurance here.",
        )

    if body.payment_type not in ("Consultation", "Follow-up", "Lab", "Procedure"):
        raise HTTPException(status_code=400, detail="Invalid payment_type")

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
        transaction_ref=f"manual-{uuid.uuid4()}",
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


@router.post("/payments/razorpay/order", response_model=RazorpayOrderOut, status_code=201)
def create_razorpay_payment_order(body: CreateRazorpayOrderIn, db: Session = Depends(get_db)):
    settings = get_settings()
    if not settings.razorpay_enabled:
        raise HTTPException(
            status_code=503,
            detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        )

    patient = db.get(Patient, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {body.patient_id} not found")

    if body.payment_method not in RAZORPAY_METHODS:
        raise HTTPException(status_code=400, detail="payment_method must be Card or UPI for Razorpay")

    if body.payment_type not in ("Consultation", "Follow-up", "Lab", "Procedure"):
        raise HTTPException(status_code=400, detail="Invalid payment_type")

    payment_id = next_payment_id(db)
    order = create_razorpay_order(
        amount_inr=body.amount,
        receipt=payment_id,
        notes={
            "payment_id": payment_id,
            "patient_id": body.patient_id,
            "payment_method": body.payment_method,
            "actor_name": body.actor_name,
        },
    )

    now = utcnow()
    payment = Payment(
        payment_id=payment_id,
        patient_id=body.patient_id,
        encounter_id=body.encounter_id,
        amount=body.amount,
        currency="INR",
        payment_type=body.payment_type,
        payment_method=body.payment_method,
        status="Pending",
        transaction_ref=order["id"],
        created_at=now,
        completed_at=None,
    )
    db.add(payment)

    write_audit(
        db,
        user=body.actor_name,
        role=body.actor_role,
        action=f"Razorpay order created for {payment_id} ({order['id']})",
        patient_id=body.patient_id,
        agent="Razorpay",
        result="Info",
    )

    db.commit()
    db.refresh(payment)

    return RazorpayOrderOut(
        payment_id=payment.payment_id,
        order_id=order["id"],
        amount=payment.amount,
        amount_paise=amount_to_paise(payment.amount),
        currency=payment.currency,
        key_id=settings.razorpay_key_id or "",
        patient_id=payment.patient_id,
        payment_method=payment.payment_method,
    )


@router.post("/payments/razorpay/verify", response_model=PaymentOut)
def verify_razorpay_payment(body: VerifyRazorpayPaymentIn, db: Session = Depends(get_db)):
    payment = db.get(Payment, body.payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment {body.payment_id} not found")

    if payment.status == "Completed":
        return payment

    if payment.transaction_ref and payment.transaction_ref != body.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Order ID does not match this payment")

    verify_payment_signature(
        order_id=body.razorpay_order_id,
        payment_id=body.razorpay_payment_id,
        signature=body.razorpay_signature,
    )

    payment.status = "Completed"
    payment.transaction_ref = body.razorpay_payment_id
    payment.completed_at = utcnow()

    write_audit(
        db,
        user=body.actor_name,
        role=body.actor_role,
        action=(
            f"Payment {payment.payment_id} completed via Razorpay: "
            f"₹{payment.amount} ({body.razorpay_payment_id})"
        ),
        patient_id=payment.patient_id,
        agent="Razorpay",
    )

    db.commit()
    db.refresh(payment)
    return payment


@router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature")
    verify_webhook_signature(body, signature)

    payload = json.loads(body.decode("utf-8"))
    event = payload.get("event")
    if event != "payment.captured":
        return {"ok": True, "ignored": event}

    entity = (((payload.get("payload") or {}).get("payment") or {}).get("entity")) or {}
    order_id = entity.get("order_id")
    razorpay_payment_id = entity.get("id")
    if not order_id or not razorpay_payment_id:
        return {"ok": True, "ignored": "missing ids"}

    payment = db.scalar(select(Payment).where(Payment.transaction_ref == order_id))
    if not payment:
        # Already verified path stores pay_ id — try match by notes payment_id if present
        notes = entity.get("notes") or {}
        local_id = notes.get("payment_id")
        if local_id:
            payment = db.get(Payment, local_id)

    if not payment:
        return {"ok": True, "ignored": "payment not found"}

    if payment.status != "Completed":
        payment.status = "Completed"
        payment.transaction_ref = razorpay_payment_id
        payment.completed_at = utcnow()
        write_audit(
            db,
            user="Razorpay",
            role="System",
            action=f"Webhook captured payment {payment.payment_id} ({razorpay_payment_id})",
            patient_id=payment.patient_id,
            agent="Razorpay",
        )
        db.commit()

    return {"ok": True}


@router.get("/payments/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    payment = db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail=f"Payment {payment_id} not found")
    return payment
