from pydantic import BaseModel, ConfigDict


class SpecialistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    specialist_id: str
    name: str
    specialty: str
    facility: str
    location: str
    availability: str
    active_referrals: int