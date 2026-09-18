"""Razorpay client helpers for consultation checkout."""

from __future__ import annotations

import hmac
import hashlib

import razorpay
from fastapi import HTTPException

from app.config import get_settings


def get_razorpay_client() -> razorpay.Client:
    settings = get_settings()
    if not settings.razorpay_enabled:
        raise HTTPException(
            status_code=503,
            detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        )
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def amount_to_paise(amount_inr: float) -> int:
    paise = int(round(float(amount_inr) * 100))
    if paise < 100:
        raise HTTPException(status_code=400, detail="Amount must be at least ₹1.00")
    return paise


def create_razorpay_order(
    *,
    amount_inr: float,
    receipt: str,
    notes: dict | None = None,
) -> dict:
    client = get_razorpay_client()
    payload = {
        "amount": amount_to_paise(amount_inr),
        "currency": "INR",
        "receipt": receipt[:40],
        "payment_capture": 1,
        "notes": notes or {},
    }
    try:
        return client.order.create(data=payload)
    except Exception as exc:  # noqa: BLE001 — surface gateway errors cleanly
        raise HTTPException(status_code=502, detail=f"Razorpay order failed: {exc}") from exc


def create_upi_qr(
    *,
    amount_inr: float,
    name: str,
    description: str,
    notes: dict | None = None,
) -> dict:
    """Create a single-use UPI QR code (desk scan flow)."""
    client = get_razorpay_client()
    payload = {
        "type": "upi_qr",
        "name": (name or "ClinicalFlow AI")[:255],
        "usage": "single_use",
        "fixed_amount": True,
        "payment_amount": amount_to_paise(amount_inr),
        "description": (description or "Consultation fee")[:255],
        "notes": notes or {},
    }
    try:
        return client.qrcode.create(data=payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Razorpay UPI QR failed: {exc}") from exc


def fetch_upi_qr_payments(qr_id: str) -> list[dict]:
    client = get_razorpay_client()
    try:
        # razorpay-python exposes fetch_all_payments (not fetch_payments)
        result = client.qrcode.fetch_all_payments(qr_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Razorpay QR status failed: {exc}") from exc
    if isinstance(result, dict):
        items = result.get("items") or []
        return list(items) if isinstance(items, list) else []
    if isinstance(result, list):
        return result
    return []


def verify_payment_signature(
    *,
    order_id: str,
    payment_id: str,
    signature: str,
) -> None:
    client = get_razorpay_client()
    try:
        client.utility.verify_payment_signature(
            {
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": signature,
            }
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid Razorpay payment signature") from exc


def verify_webhook_signature(body: bytes, signature: str | None) -> None:
    settings = get_settings()
    if not settings.razorpay_webhook_secret:
        raise HTTPException(status_code=503, detail="Razorpay webhook secret is not configured")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing X-Razorpay-Signature")

    expected = hmac.new(
        settings.razorpay_webhook_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")
