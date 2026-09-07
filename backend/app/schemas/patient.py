from pydantic import BaseModel, ConfigDict


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_id: str
    name: str
    date_of_birth: str
    gender: str
    age: int
    risk: str
    conditions: list
    medications: list
    encounters: list
    labs: list
    workflow_status: str
    last_encounter: str
    issues_count: int
    referrals_count: int