from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReferralRule
from app.schemas import ReferralRuleOut

router = APIRouter(tags=["referral-rules"])


@router.get("/referral-rules", response_model=list[ReferralRuleOut])
def list_referral_rules(db: Session = Depends(get_db)):
    return list(db.scalars(select(ReferralRule).order_by(ReferralRule.rule_id)).all()) 