from pydantic import BaseModel, ConfigDict


class ReferralRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rule_id: str
    condition: str
    trigger: str
    expression: dict
    specialist: str
    priority: str
    enabled: bool