"""Consultation vs follow-up fee rules.

- New patient / first visit, or last paid visit older than 4 months → ₹500 (Consultation)
- Returning patient with a completed visit payment within the last 4 months → ₹250 (Follow-up)
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Payment
from app.services.ids import utcnow

NEW_CONSULTATION_FEE = 500.0
FOLLOW_UP_FEE = 250.0
FOLLOW_UP_WINDOW_MONTHS = 4
VISIT_PAYMENT_TYPES = ("Consultation", "Follow-up")


@dataclass(frozen=True)
class FeeQuote:
    amount: float
    payment_type: str  # Consultation | Follow-up
    is_follow_up: bool
    label: str
    last_visit_at: datetime | None
    reason: str


def _as_naive_utc(dt: datetime) -> datetime:
    """SQLite often returns naive datetimes; utcnow() is aware — normalize before compare."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def _subtract_months(dt: datetime, months: int) -> datetime:
    year = dt.year
    month = dt.month - months
    while month <= 0:
        month += 12
        year -= 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def last_completed_visit_payment(db: Session, patient_id: str) -> Payment | None:
    return db.scalar(
        select(Payment)
        .where(
            Payment.patient_id == patient_id,
            Payment.status == "Completed",
            Payment.payment_type.in_(VISIT_PAYMENT_TYPES),
        )
        .order_by(Payment.completed_at.desc(), Payment.created_at.desc())
        .limit(1)
    )


def quote_consultation_fee(db: Session, patient_id: str, *, now: datetime | None = None) -> FeeQuote:
    """Return the fee that should be charged for the patient's current visit."""
    now = _as_naive_utc(now or utcnow())
    last = last_completed_visit_payment(db, patient_id)

    if last is None:
        return FeeQuote(
            amount=NEW_CONSULTATION_FEE,
            payment_type="Consultation",
            is_follow_up=False,
            label="New consultation",
            last_visit_at=None,
            reason="No previous completed visit payment on record",
        )

    last_at = _as_naive_utc(last.completed_at or last.created_at)
    window_start = _subtract_months(now, FOLLOW_UP_WINDOW_MONTHS)

    if last_at >= window_start:
        return FeeQuote(
            amount=FOLLOW_UP_FEE,
            payment_type="Follow-up",
            is_follow_up=True,
            label="Follow-up consultation",
            last_visit_at=last_at,
            reason=f"Previous visit within {FOLLOW_UP_WINDOW_MONTHS} months",
        )

    return FeeQuote(
        amount=NEW_CONSULTATION_FEE,
        payment_type="Consultation",
        is_follow_up=False,
        label="New consultation",
        last_visit_at=last_at,
        reason=f"Previous visit older than {FOLLOW_UP_WINDOW_MONTHS} months",
    )
