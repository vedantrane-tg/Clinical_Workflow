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