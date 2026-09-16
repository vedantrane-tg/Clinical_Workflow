from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CdsRequest(BaseModel):
    actor_name: str = "Doctor"
    actor_role: str = "Doctor"


class PrescriptionItemIn(BaseModel):
    seq: int | None = None
    drug_form: str
    drug_name: str
    drug_label: str | None = None
    strength: str | None = ""
    morning: int = 0
    afternoon: int = 0
    night: int = 0
    frequency: str | None = None
    duration_value: int = 1
    duration_unit: str = "day(s)"
    instruction: str | None = ""
    instructions_text: str | None = None


class FinalizeEncounterIn(BaseModel):
    approved_labs: list[dict] = []
    approved_medications: list[dict] = []
    approved_icd_codes: list[dict] = []
    approved_referrals: list[dict] = []
    prescription: list[PrescriptionItemIn] = []
    doctor_notes: str | None = None
    actor_name: str = "Doctor"
    actor_role: str = "Doctor"


class PrescriptionPdfIn(BaseModel):
    prescription: list[PrescriptionItemIn] = Field(min_length=1)
    actor_name: str = "Doctor"


class EncounterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    encounter_id: str
    patient_id: str
    consultation_id: str | None = None
    triage_id: str | None = None
    doctor_id: str
    doctor_name: str
    soap_subjective: str | None = None
    soap_objective: str | None = None
    soap_assessment: str | None = None
    soap_plan: str | None = None
    suggested_labs: list = Field(default_factory=list)
    suggested_medications: list = Field(default_factory=list)
    suggested_icd_codes: list = Field(default_factory=list)
    suggested_referrals: list = Field(default_factory=list)
    approved_labs: list | None = None
    approved_medications: list | None = None
    approved_icd_codes: list | None = None
    approved_referrals: list | None = None
    prescription: list | None = None
    prescription_pdf_path: str | None = None
    status: str
    finalized_at: datetime | None = None
    finalized_by: str | None = None
    created_at: datetime
