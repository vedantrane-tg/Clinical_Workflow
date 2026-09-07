from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Patient, Referral, ReferralRule, Specialist, WorkflowExecution
from app.services.ids import next_referral_id, next_workflow_id, utcnow, write_audit

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    ClinicalSummary,
    ExtractedEHR,
    Patient,
    Referral,
    ReferralRule,
    Specialist,
    WorkflowExecution,
)
from app.services.ids import (
    next_issue_id,
    next_referral_id,
    next_workflow_id,
    utcnow,
    write_audit,
)

from app.services.ai_summary import generate_ai_narrative

def _lab_matches(patient: Patient, expression: dict) -> bool:
    test = expression.get("test")
    operator = expression.get("operator")
    threshold = expression.get("threshold")
    if test is None or operator is None or threshold is None:
        return False

    labs = {lab.get("test"): lab.get("value") for lab in (patient.labs or [])}
    value = labs.get(test)
    if value is None:
        return False

    value = float(value)
    threshold = float(threshold)
    if operator == ">":
        return value > threshold
    if operator == "<":
        return value < threshold
    if operator == ">=":
        return value >= threshold
    return False


def run_patient_workflow(db: Session, *, patient: Patient, actor_name: str, actor_role: str) -> WorkflowExecution:
    started = utcnow()
    workflow_id = next_workflow_id(db)

    # ---------- Agent 1: EHR Extraction ----------
    ehr_payload = {
        "demographics": {
            "patientId": patient.patient_id,
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "dateOfBirth": patient.date_of_birth,
        },
        "conditions": patient.conditions or [],
        "medications": patient.medications or [],
        "encounters": patient.encounters or [],
        "labs": patient.labs or [],
        "extracted_at": started,
        "source": "FastAPI clinical store",
    }
    existing_ehr = db.get(ExtractedEHR, patient.patient_id)
    if existing_ehr is None:
        db.add(ExtractedEHR(patient_id=patient.patient_id, **ehr_payload))
    else:
        for key, value in ehr_payload.items():
            setattr(existing_ehr, key, value)

    # ---------- Agent 2: Clinical Summary ----------
    rules = list(db.scalars(select(ReferralRule).where(ReferralRule.enabled == True)).all())  # noqa: E712
    matched = [r for r in rules if _lab_matches(patient, r.expression or {})]

    issues = []
    for rule in matched:
        evidence_lab = next(
            (lab for lab in (patient.labs or []) if lab.get("test") == (rule.expression or {}).get("test")),
            None,
        )
        issues.append(
            {
                "issue_id": next_issue_id(db),
                "patient_id": patient.patient_id,
                "severity": rule.priority,
                "issue": rule.trigger,
                "evidence": (
                    f"{evidence_lab['test']}={evidence_lab['value']} {evidence_lab.get('unit', '')}".strip()
                    if evidence_lab
                    else rule.trigger
                ),
                "source": "Referral rules engine",
                "detected_by": "patient-summary",
                "rule_id": rule.rule_id,
                "rule_expression": rule.trigger,
                "recommended_specialist": rule.specialist,
                "referral_status": "Not Referred",
            }
        )

    # abnormal = [lab for lab in (patient.labs or []) if lab.get("status") in {"HIGH", "LOW", "CRITICAL"}]
    # condition_names = ", ".join(c.get("name", "") for c in (patient.conditions or [])) or "no active conditions"

    abnormal = [lab for lab in (patient.labs or []) if lab.get("status") in {"HIGH", "LOW", "CRITICAL"}]
    condition_names = ", ".join(c.get("name", "") for c in (patient.conditions or [])) or "no active conditions"

    # Build EHR + rules payloads for the AI
    ehr_for_ai = {
        "patient_id": patient.patient_id,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "date_of_birth": patient.date_of_birth,
        "conditions": patient.conditions or [],
        "medications": patient.medications or [],
        "encounters": patient.encounters or [],
        "labs": patient.labs or [],
    }
    rules_for_ai = [
        {
            "rule_id": r.rule_id,
            "condition": r.condition,
            "trigger": r.trigger,
            "expression": r.expression,
            "specialist": r.specialist,
            "priority": r.priority,
            "enabled": r.enabled,
        }
        for r in rules
    ]

    ai_result = generate_ai_narrative(ehr_for_ai, rules_for_ai)

    if ai_result is not None:
        narrative = ai_result["narrative"]
        summary_payload = {
            "summary": narrative.get("summary", ""),
            "sections": narrative.get("sections", []),
            "concerns": narrative.get("concerns", [i["issue"] for i in issues]),
            "abnormal_labs": abnormal,
            "medication_conflicts": narrative.get("medication_conflicts", []),
            "recommended_actions": narrative.get(
                "recommended_actions",
                [f"Refer to {i['recommended_specialist']} for {i['issue']}" for i in issues],
            ),
            "issues": issues,  # keep rule-based issues for referrals
            "generated_at": utcnow(),
            "model": ai_result["model"],
        }
    else:
        # Fallback if AI key missing or API fails
        summary_payload = {
            "summary": (
                f"{patient.name} is a {patient.age}-year-old {patient.gender.lower()} with {condition_names}. "
                f"{len(issues)} referral trigger(s) detected."
            ),
            "sections": [
                {"heading": "Conditions", "body": condition_names},
                {
                    "heading": "Abnormal labs",
                    "body": ", ".join(f"{l['test']} {l['value']}" for l in abnormal) or "None",
                },
            ],
            "concerns": [i["issue"] for i in issues],
            "abnormal_labs": abnormal,
            "medication_conflicts": [],
            "recommended_actions": [
                f"Refer to {i['recommended_specialist']} for {i['issue']}" for i in issues
            ],
            "issues": issues,
            "generated_at": utcnow(),
            "model": "rules-engine-v1",
        }

    # ---------- Agent 3: Referral Orchestration ----------
    created_ids: list[str] = []
    for issue in issues:
        specialty = issue["recommended_specialist"]
        specialist = db.scalars(
            select(Specialist)
            .where(
                Specialist.specialty == specialty,
                Specialist.availability != "Unavailable",
            )
            .order_by(Specialist.active_referrals.asc())
        ).first()
        if not specialist:
            continue

        referral = Referral(
            referral_id=next_referral_id(db),
            patient_id=patient.patient_id,
            patient_name=patient.name,
            issue=issue["issue"],
            specialist_type=specialty,
            specialist_id=specialist.specialist_id,
            specialist_name=specialist.name,
            priority=issue["severity"],
            status="Created",
            created_at=utcnow(),
            agent_notes=f"Auto-created by referral-orchestrator for rule {issue['rule_id']}",
            created_by=f"Agent · referral-orchestrator (triggered by {actor_role} {actor_name})",
        )
        db.add(referral)
        specialist.active_referrals += 1
        created_ids.append(referral.referral_id)
        issue["referral_status"] = "Created"

    summary_payload["issues"] = issues

    existing_summary = db.get(ClinicalSummary, patient.patient_id)
    if existing_summary is None:
        db.add(ClinicalSummary(patient_id=patient.patient_id, **summary_payload))
    else:
        for key, value in summary_payload.items():
            setattr(existing_summary, key, value)

    completed = utcnow()
    duration_ms = int((completed - started).total_seconds() * 1000)

    workflow = WorkflowExecution(
        workflow_id=workflow_id,
        patient_id=patient.patient_id,
        patient_name=patient.name,
        status="Completed",
        current_agent=None,
        started_at=started,
        completed_at=completed,
        duration_ms=duration_ms,
        agent_steps=[
            {
                "agent_id": "ehr-extractor",
                "name": "EHR Extraction",
                "status": "Completed",
                "output_summary": f"Extracted chart for {patient.patient_id}",
                "output": {"source": ehr_payload["source"]},
                "error": None,
            },
            {
                "agent_id": "patient-summary",
                "name": "Clinical Summary",
                "status": "Completed",
                "output_summary": f"{len(issues)} issue(s) flagged",
                "output": {"issue_count": len(issues)},
                "error": None,
            },
            {
                "agent_id": "referral-orchestrator",
                "name": "Referral Orchestration",
                "status": "Completed",
                "output_summary": f"Created {len(created_ids)} referral(s)",
                "output": {
                    "matched_rules": [r.rule_id for r in matched],
                    "referral_ids": created_ids,
                },
                "error": None,
            },
        ],
        error=None,
    )
    db.add(workflow)

    patient.workflow_status = "Completed"
    patient.issues_count = len(issues)
    db.flush()
    patient.referrals_count = len(
        list(db.scalars(select(Referral).where(Referral.patient_id == patient.patient_id)).all())
    )

    write_audit(
        db,
        user=actor_name,
        role=actor_role,
        action=f"Ran 3-agent workflow {workflow_id} for {patient.patient_id}",
        patient_id=patient.patient_id,
        agent="workflow",
        result="Success",
    )
    return workflow