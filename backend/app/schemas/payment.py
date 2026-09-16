from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CreatePaymentIn(BaseModel):
    patient_id: str
    amount: float = Field(gt=0)
    payment_type: str = "Consultation"  # Consultation | Follow-up | Lab | Procedure
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


class CreateRazorpayOrderIn(BaseModel):
    patient_id: str
    amount: float = Field(gt=0)
    payment_type: str = "Consultation"
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
