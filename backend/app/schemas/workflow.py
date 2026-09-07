from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class Actor(BaseModel):
    name: str
    role: str


class RunWorkflowIn(BaseModel):
    actor: Actor


class WorkflowOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workflow_id: str
    patient_id: str
    patient_name: str
    status: str
    current_agent: str | None
    started_at: datetime
    completed_at: datetime | None
    duration_ms: int | None
    agent_steps: list[Any]
    error: str | None