import type { AgentStep, Role, WorkflowExecution } from "@/types/clinical";
import { getStore, nextId } from "@/services/mock/store";
import { delay } from "@/services/mock/latency";
import { mockHealthLakeService } from "@/services/mock/healthLake";
import { mockBedrockService } from "@/services/mock/bedrock";
import { mockDynamoDBService } from "@/services/mock/dynamodb";
import { mockSNSService } from "@/services/mock/sns";
import { ehrExtractorAgent, patientSummaryAgent, referralOrchestratorAgent, type AgentContext } from "./agents";

const AGENT_DEFS: { agent_id: AgentStep["agent_id"]; name: string }[] = [
  { agent_id: "ehr-extractor", name: "EHR Extractor Agent" },
  { agent_id: "patient-summary", name: "Patient Summary Agent" },
  { agent_id: "referral-orchestrator", name: "Referral Orchestrator Agent" },
];

function emptySteps(): AgentStep[] {
  return AGENT_DEFS.map((d) => ({
    ...d,
    status: "Waiting" as const,
    started_at: null,
    completed_at: null,
    duration_ms: null,
    output_summary: null,
    output: null,
    error: null,
  }));
}

export interface RunWorkflowOptions {
  patientId: string;
  actor: { name: string; role: Role };
  onUpdate?: ((execution: WorkflowExecution) => void) | undefined;
}

/**
 * mockAgentWorkflow() — sequential three-agent graph.
 * Replace with strandsGraphBuilderWorkflow() where GraphBuilder wires:
 * EHR Extractor Agent -> Patient Summary Agent -> Referral Orchestrator Agent.
 */
export async function mockAgentWorkflow({
  patientId,
  actor,
  onUpdate,
}: RunWorkflowOptions): Promise<WorkflowExecution> {
  const store = getStore();
  const patient = store.patients.find((p) => p.patient_id === patientId);
  const startedAt = Date.now();

  const execution: WorkflowExecution = {
    workflow_id: nextId("workflow"),
    patient_id: patientId,
    patient_name: patient?.name ?? "Unknown patient",
    status: "Queued",
    current_agent: null,
    started_at: new Date(startedAt).toISOString(),
    completed_at: null,
    duration_ms: null,
    agent_steps: emptySteps(),
    error: null,
  };

  const ctx: AgentContext = {
    healthLake: mockHealthLakeService,
    bedrock: mockBedrockService,
    db: mockDynamoDBService,
    sns: mockSNSService,
    actor,
  };

  const persist = async () => {
    await mockDynamoDBService.putWorkflow(JSON.parse(JSON.stringify(execution)) as WorkflowExecution);
    onUpdate?.(JSON.parse(JSON.stringify(execution)) as WorkflowExecution);
  };

  const setPatientStatus = (status: WorkflowExecution["status"]) => {
    if (patient) patient.workflow_status = status;
  };

  await persist();
  await mockDynamoDBService.putAudit({
    user: actor.name,
    role: actor.role,
    action: `${actor.role} triggered clinical workflow ${execution.workflow_id}`,
    patient_id: patientId,
    agent: null,
    result: "Info",
  });

  const runStep = async <T>(index: number, status: WorkflowExecution["status"], fn: () => Promise<T>) => {
    const step = execution.agent_steps[index]!;
    step.status = "Running";
    step.started_at = new Date().toISOString();
    execution.status = status;
    execution.current_agent = step.name;
    setPatientStatus(status);
    await persist();
    await delay(900);
    const stepStart = Date.now();
    try {
      const result = await fn();
      step.status = "Completed";
      step.completed_at = new Date().toISOString();
      step.duration_ms = Date.now() - stepStart + 900;
      return result;
    } catch (error) {
      step.status = "Failed";
      step.completed_at = new Date().toISOString();
      step.error = error instanceof Error ? error.message : "Unknown agent failure";
      execution.status = "Failed";
      execution.error = step.error;
      execution.completed_at = new Date().toISOString();
      setPatientStatus("Failed");
      await mockDynamoDBService.putAudit({
        user: "agent",
        role: actor.role,
        action: `${step.name} failed: ${step.error}`,
        patient_id: patientId,
        agent: step.name,
        result: "Failed",
      });
      await persist();
      throw error;
    }
  };

  try {
    const ehr = await runStep(0, "Extracting", () => ehrExtractorAgent(ctx, patientId));
    const step0 = execution.agent_steps[0]!;
    step0.output = ehr;
    step0.output_summary = `${ehr.conditions.length} conditions · ${ehr.medications.length} medications · ${ehr.encounters.length} encounters · ${ehr.labs.length} lab results`;
    await persist();

    const summary = await runStep(1, "Summarizing", () => patientSummaryAgent(ctx, ehr));
    const step1 = execution.agent_steps[1]!;
    step1.output = summary;
    step1.output_summary = `Clinical summary generated · ${summary.issues.length} issue(s) flagged · ${summary.medication_conflicts.length} medication conflict(s)`;
    if (patient) patient.issues_count = summary.issues.length;
    await persist();

    const orchestration = await runStep(2, "Orchestrating Referral", () =>
      referralOrchestratorAgent(ctx, summary, execution.patient_name),
    );
    const step2 = execution.agent_steps[2]!;
    step2.output = orchestration;
    step2.output_summary = orchestration.referrals.length
      ? `${orchestration.referrals.length} referral(s) created: ${orchestration.referrals
          .map((r) => `${r.referral_id} → ${r.specialist_type}`)
          .join(", ")}`
      : "No referral rules triggered — no referral created.";

    execution.status = "Completed";
    execution.current_agent = null;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = Date.now() - startedAt;
    setPatientStatus("Completed");
    if (patient) {
      patient.referrals_count = store.referrals.filter((r) => r.patient_id === patientId).length;
    }
    await persist();
    await mockDynamoDBService.putAudit({
      user: actor.name,
      role: actor.role,
      action: `Workflow ${execution.workflow_id} completed in ${(execution.duration_ms / 1000).toFixed(1)}s`,
      patient_id: patientId,
      agent: null,
      result: "Success",
    });
    return execution;
  } catch {
    return execution;
  }
}