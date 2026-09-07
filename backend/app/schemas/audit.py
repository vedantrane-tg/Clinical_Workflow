from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    audit_id: str
    user: str
    role: str
    action: str
    patient_id: str | None
    agent: str | None
    timestamp: datetime
    result: str