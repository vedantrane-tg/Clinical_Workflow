from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Patient
from app.models import Specialist
from app.models import ReferralRule
from app.models import AuditEntry  # plus your existing imports
from app.services.ids import utcnow

def seed_patients(db: Session) -> None:
    # Skip if data already exists
    if db.scalar(select(Patient).limit(1)) is not None:
        return

    patients = [
        Patient(
            patient_id="PAT-1001",
            name="Aarav Sharma",
            date_of_birth="1968-04-12",
            gender="Male",
            age=58,
            risk="High",
            conditions=[
                {
                    "name": "Type 2 Diabetes Mellitus",
                    "code": "E11.9",
                    "codeSystem": "ICD-10",
                    "status": "Active",
                    "onsetDate": "2020-01-01",
                }
            ],
            medications=[
                {
                    "name": "Metformin",
                    "dose": "1000 mg",
                    "frequency": "BID",
                    "status": "Active",
                    "startDate": "2021-01-01",
                }
            ],
            encounters=[
                {
                    "date": "2026-07-28",
                    "type": "Outpatient Visit",
                    "provider": "Dr. Primary Care",
                    "reason": "Routine follow-up",
                }
            ],
            labs=[
                {
                    "test": "HbA1c",
                    "value": 10.2,
                    "unit": "%",
                    "referenceRange": "4.0-5.6",
                    "status": "CRITICAL",
                    "date": "2026-07-28",
                }
            ],
            workflow_status="Not Started",
            last_encounter="2026-07-28",
            issues_count=0,
            referrals_count=0,
        ),
        Patient(
            patient_id="PAT-1002",
            name="Priya Patel",
            date_of_birth="1975-09-03",
            gender="Female",
            age=50,
            risk="Medium",
            conditions=[],
            medications=[],
            encounters=[],
            labs=[],
            workflow_status="Not Started",
            last_encounter="2026-07-19",
            issues_count=0,
            referrals_count=0,
        ),
    ]

    db.add_all(patients)
    db.commit()


def seed_specialists(db: Session) -> None:
    if db.scalar(select(Specialist).limit(1)) is not None:
        return

    specialists = [
        Specialist(
            specialist_id="SPC-2001",
            name="Dr. Meera Shah",
            specialty="Endocrinologist",
            facility="Sunrise Multispecialty Hospital",
            location="Pune, MH",
            availability="Available",
            active_referrals=4,
        ),
        Specialist(
            specialist_id="SPC-2002",
            name="Dr. Vikram Rao",
            specialty="Nephrologist",
            facility="Greenfield Renal Institute",
            location="Mumbai, MH",
            availability="Available",
            active_referrals=3,
        ),
        Specialist(
            specialist_id="SPC-2003",
            name="Dr. Anjali Mehta",
            specialty="Cardiologist",
            facility="Metro Heart Centre",
            location="Bengaluru, KA",
            availability="Limited",
            active_referrals=6,
        ),
    ]
    db.add_all(specialists)
    db.commit()




def seed_referral_rules(db: Session) -> None:
    if db.scalar(select(ReferralRule).limit(1)) is not None:
        return

    rules = [
        ReferralRule(
            rule_id="RULE-001",
            condition="Type 2 Diabetes Mellitus",
            trigger="HbA1c > 9.0%",
            expression={"type": "lab", "test": "HbA1c", "operator": ">", "threshold": 9.0},
            specialist="Endocrinologist",
            priority="High",
            enabled=True,
        ),
        ReferralRule(
            rule_id="RULE-002",
            condition="Chronic Kidney Disease / Renal impairment",
            trigger="Creatinine > 1.5 mg/dL",
            expression={"type": "lab", "test": "Creatinine", "operator": ">", "threshold": 1.5},
            specialist="Nephrologist",
            priority="High",
            enabled=True,
        ),
        ReferralRule(
            rule_id="RULE-003",
            condition="Hyperlipidemia",
            trigger="Triglycerides > 400 mg/dL",
            expression={"type": "lab", "test": "Triglycerides", "operator": ">", "threshold": 400},
            specialist="Other",
            priority="Low",
            enabled=False,
        ),
    ]
    db.add_all(rules)
    db.commit()



def seed_audit(db: Session) -> None:
    if db.scalar(select(AuditEntry).limit(1)) is not None:
        return

    db.add(
        AuditEntry(
            audit_id="AUD-0001",
            user="system",
            role="Clinician",
            action="Environment initialised with synthetic dataset",
            patient_id=None,
            agent=None,
            timestamp=utcnow(),
            result="Info",
        )
    )
    db.commit()