from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CreatePaymentIn(BaseModel):
    patient_id: str
    # Optional — server calculates consultation/follow-up fee when omitted.
    amount: float | None = Field(default=None, gt=0)
    payment_type: str | None = None  # Consultation | Follow-up | Lab | Procedure
    payment_method: str  # Cash | Card | UPI | Insurance
    encounter_id: str | None = None
    actor_name: str = "Receptionist"
    actor_role: str = "Receptionist"


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    payment_id: str
    patient_id: str
    encounter_id: str | None = None
    amount: float
    currency: str
    payment_type: str
    payment_method: str
    status: str
    transaction_ref: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class ConsultationFeeQuoteOut(BaseModel):
    patient_id: str
    amount: float
    payment_type: str
    is_follow_up: bool
    label: str
    last_visit_at: datetime | None = None
    reason: str
    currency: str = "INR"
    new_consultation_fee: float = 500
    follow_up_fee: float = 250
    follow_up_window_months: int = 4


class CreateRazorpayOrderIn(BaseModel):
    patient_id: str
    amount: float | None = Field(default=None, gt=0)
    payment_type: str | None = None
    payment_method: str  # Card | UPI
    encounter_id: str | None = None
    actor_name: str = "Receptionist"
    actor_role: str = "Receptionist"


class RazorpayOrderOut(BaseModel):
    payment_id: str
    order_id: str
    amount: float
    amount_paise: int
    currency: str
    key_id: str
    patient_id: str
    payment_method: str


class VerifyRazorpayPaymentIn(BaseModel):
    payment_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    actor_name: str = "Receptionist"
    actor_role: str = "Receptionist"


class RazorpayConfigOut(BaseModel):
    enabled: bool
    key_id: str | None = None


class CreateUpiQrIn(BaseModel):
    patient_id: str
    amount: float | None = Field(default=None, gt=0)
    payment_type: str | None = None
    encounter_id: str | None = None
    actor_name: str = "Receptionist"
    actor_role: str = "Receptionist"


class UpiQrOut(BaseModel):
    payment_id: str
    qr_id: str
    image_url: str
    amount: float
    amount_paise: int
    currency: str
    patient_id: str
    status: str
