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
from app.services.ai_summary import build_rich_clinical_summary

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


def _build_snapshot(workflow_id, patient, status, current_agent, started, agent_steps, error=None, completed=None, duration_ms=None) -> dict:
    """Build a JSON-serializable workflow snapshot for SSE events."""
    return {
        "workflow_id": workflow_id,
        "patient_id": patient.patient_id,
        "patient_name": patient.name,
        "status": status,
        "current_agent": current_agent,
        "started_at": started.isoformat(),
        "completed_at": completed.isoformat() if completed else None,
        "duration_ms": duration_ms,
        "agent_steps": agent_steps,
        "error": error,
    }


def run_patient_workflow_streaming(db: Session, *, patient: Patient, actor_name: str, actor_role: str):
    """
    Generator that yields JSON-serializable workflow snapshots after each agent step.
    The final yield is the completed workflow. Commits to DB at the end.
    """
    import time

    started = utcnow()
    workflow_id = next_workflow_id(db)

    # Initialise agent_steps as dicts (JSON-serializable)
    agent_steps = [
        {
            "agent_id": "ehr-extractor",
            "name": "EHR Extraction",
            "status": "Waiting",
            "output_summary": None,
            "output": None,
            "error": None,
        },
        {
            "agent_id": "patient-summary",
            "name": "Clinical Summary",
            "status": "Waiting",
            "output_summary": None,
            "output": None,
            "error": None,
        },
        {
            "agent_id": "referral-orchestrator",
            "name": "Referral Orchestration",
            "status": "Waiting",
            "output_summary": None,
            "output": None,
            "error": None,
        },
    ]

    # ── Yield initial "Queued" state ──
    yield _build_snapshot(workflow_id, patient, "Queued", None, started, agent_steps)

    # ---------- Agent 1: EHR Extraction ----------
    agent_steps[0]["status"] = "Running"
    yield _build_snapshot(workflow_id, patient, "Extracting", "EHR Extraction", started, agent_steps)
    time.sleep(1.2)  # simulate agent processing time

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

    agent_steps[0]["status"] = "Completed"
    agent_steps[0]["output_summary"] = (
        f"{len(patient.conditions or [])} conditions · "
        f"{len(patient.medications or [])} medications · "
        f"{len(patient.encounters or [])} encounters · "
        f"{len(patient.labs or [])} lab results"
    )
    agent_steps[0]["output"] = {**ehr_payload, "extracted_at": started.isoformat()}
    yield _build_snapshot(workflow_id, patient, "Extracting", "EHR Extraction", started, agent_steps)

    # ---------- Agent 2: Clinical Summary ----------
    agent_steps[1]["status"] = "Running"
    yield _build_snapshot(workflow_id, patient, "Summarizing", "Clinical Summary", started, agent_steps)
    time.sleep(1.0)  # simulate agent processing time

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

    # Build EHR + rules payloads for AI
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

    summary_payload = build_rich_clinical_summary(
        patient=patient,
        rules=rules,
        issues=issues,
        ehr_for_ai=ehr_for_ai,
        rules_for_ai=rules_for_ai,
    )

    agent_steps[1]["status"] = "Completed"
    agent_steps[1]["output_summary"] = (
        f"Clinical summary generated · {len(issues)} issue(s) flagged · "
        f"{len(summary_payload.get('medication_conflicts', []))} medication conflict(s)"
    )
    agent_steps[1]["output"] = {
        **summary_payload,
        "generated_at": (
            summary_payload["generated_at"].isoformat()
            if hasattr(summary_payload.get("generated_at"), "isoformat")
            else str(summary_payload.get("generated_at"))
        ),
    }
    yield _build_snapshot(workflow_id, patient, "Summarizing", "Clinical Summary", started, agent_steps)

    # ---------- Agent 3: Referral Orchestration ----------
    agent_steps[2]["status"] = "Running"
    yield _build_snapshot(workflow_id, patient, "Orchestrating Referral", "Referral Orchestration", started, agent_steps)
    time.sleep(1.0)  # simulate agent processing time

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

    agent_steps[2]["status"] = "Completed"
    if created_ids:
        agent_steps[2]["output_summary"] = (
            f"{len(created_ids)} referral(s) created: "
            + ", ".join(created_ids)
        )
    else:
        agent_steps[2]["output_summary"] = "No referral rules triggered — no referral created."
    agent_steps[2]["output"] = {
        "matched_rules": [r.rule_id for r in matched],
        "referral_ids": created_ids,
    }

    workflow = WorkflowExecution(
        workflow_id=workflow_id,
        patient_id=patient.patient_id,
        patient_name=patient.name,
        status="Completed",
        current_agent=None,
        started_at=started,
        completed_at=completed,
        duration_ms=duration_ms,
        agent_steps=agent_steps,
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

    db.commit()
    db.refresh(workflow)

    # ── Final "Completed" snapshot ──
    yield _build_snapshot(workflow_id, patient, "Completed", None, started, agent_steps, completed=completed, duration_ms=duration_ms)


def run_patient_workflow(db: Session, *, patient: Patient, actor_name: str, actor_role: str) -> WorkflowExecution:
    """Non-streaming version: runs all steps and returns the final WorkflowExecution ORM object."""
    # Consume the generator, ignoring intermediate snapshots
    last_snapshot = None
    for snapshot in run_patient_workflow_streaming(db, patient=patient, actor_name=actor_name, actor_role=actor_role):
        last_snapshot = snapshot

    # Return the persisted ORM object
    return db.get(WorkflowExecution, last_snapshot["workflow_id"])