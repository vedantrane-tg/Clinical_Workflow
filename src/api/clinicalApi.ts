import type {
  AgentServiceStatus,
  AuditEntry,
  ClinicalSummary,
  ExtractedEHR,
  Patient,
  Referral,
  ReferralRule,
  Role,
  Severity,
  Specialist,
  SpecialistType,
  WorkflowExecution,
} from "@/types/clinical";
import { mockHealthLakeService } from "@/services/mock/healthLake";
import { mockDynamoDBService } from "@/services/mock/dynamodb";
import { mockSNSService } from "@/services/mock/sns";
import { mockAgentWorkflow } from "@/services/agents/workflowGraph";
import { getStore, nextId } from "@/services/mock/store";

/**
 * Single abstraction the UI talks to. Every function maps 1:1 to a REST route
 * served by API Gateway + Lambda in the target architecture. UI components must
 * never call services directly.
 */

export interface CreateReferralInput {
  patient_id: string;
  issue: string;
  specialist_type: SpecialistType;
  specialist_id: string;
  priority: Severity;
  notes: string;
  actor: { name: string; role: Role };
}

export const clinicalApi = {
  /** GET /patients */
  listPatients(): Promise<Patient[]> {
    return mockHealthLakeService.listPatients();
  },

  /** GET /patients/{id} */
  getPatient(id: string): Promise<Patient | null> {
    return mockHealthLakeService.getPatient(id);
  },

  /** GET /patients/{id}/ehr */
  getPatientEhr(id: string): Promise<ExtractedEHR | null> {
    return mockDynamoDBService.getEHR(id);
  },

  /** GET /patients/{id}/summary */
  getPatientSummary(id: string): Promise<ClinicalSummary | null> {
    return mockDynamoDBService.getSummary(id);
  },

  /** GET /patients/{id}/referrals */
  getPatientReferrals(id: string): Promise<Referral[]> {
    return mockDynamoDBService.listReferrals(id);
  },

  /** POST /patients/{id}/workflow/run */
  runWorkflow(
    id: string,
    actor: { name: string; role: Role },
    onUpdate?: (execution: WorkflowExecution) => void,
  ): Promise<WorkflowExecution> {
    return mockAgentWorkflow({ patientId: id, actor, onUpdate });
  },

  /** GET /referrals */
  listReferrals(): Promise<Referral[]> {
    return mockDynamoDBService.listReferrals();
  },

  /** GET /referrals/{id} */
  getReferral(id: string): Promise<Referral | null> {
    return mockDynamoDBService.getReferral(id);
  },

  /** POST /referrals */
  async createReferral(input: CreateReferralInput): Promise<Referral> {
    const store = getStore();
    const patient = store.patients.find((p) => p.patient_id === input.patient_id);
    if (!patient) throw new Error(`Patient ${input.patient_id} not found`);
    const specialist = store.specialists.find((s) => s.specialist_id === input.specialist_id);
    if (!specialist) throw new Error("No specialist available for the selected specialty");

    const referral: Referral = {
      referral_id: nextId("referral"),
      patient_id: patient.patient_id,
      patient_name: patient.name,
      issue: input.issue,
      specialist_type: input.specialist_type,
      specialist_id: specialist.specialist_id,
      specialist_name: specialist.name,
      priority: input.priority,
      status: "Created",
      created_at: new Date().toISOString(),
      agent_notes: input.notes || `Manually created by ${input.actor.role} ${input.actor.name}.`,
      created_by: `${input.actor.role} · ${input.actor.name}`,
    };

    await mockDynamoDBService.putReferral(referral);
    await mockSNSService.publishReferralNotification(referral);
    await mockDynamoDBService.putAudit({
      user: input.actor.name,
      role: input.actor.role,
      action: `${input.actor.role} manually created referral ${referral.referral_id} (${referral.specialist_type})`,
      patient_id: referral.patient_id,
      agent: null,
      result: "Success",
    });
    return referral;
  },

  /** PATCH /referrals/{id} — override / status change */
  async updateReferral(
    id: string,
    patch: Partial<Pick<Referral, "status" | "specialist_id" | "specialist_name" | "priority" | "agent_notes">>,
    actor: { name: string; role: Role },
  ): Promise<Referral> {
    const updated = await mockDynamoDBService.updateReferral(id, patch);
    await mockDynamoDBService.putAudit({
      user: actor.name,
      role: actor.role,
      action: `${actor.role} modified referral ${id} (${Object.keys(patch).join(", ")})`,
      patient_id: updated.patient_id,
      agent: null,
      result: "Success",
    });
    return updated;
  },

  /** GET /workflows */
  listWorkflows(): Promise<WorkflowExecution[]> {
    return mockDynamoDBService.listWorkflows();
  },

  /** GET /workflows/{id} */
  getWorkflow(id: string): Promise<WorkflowExecution | null> {
    return mockDynamoDBService.getWorkflow(id);
  },

  /** GET /specialists */
  listSpecialists(): Promise<Specialist[]> {
    return mockDynamoDBService.listSpecialists();
  },

  /** GET /referral-rules */
  listReferralRules(): Promise<ReferralRule[]> {
    return mockDynamoDBService.listRules();
  },

  /** PATCH /referral-rules/{id} */
  async setRuleEnabled(ruleId: string, enabled: boolean, actor: { name: string; role: Role }) {
    const rule = await mockDynamoDBService.setRuleEnabled(ruleId, enabled);
    await mockDynamoDBService.putAudit({
      user: actor.name,
      role: actor.role,
      action: `${enabled ? "Enabled" : "Disabled"} referral rule ${ruleId}`,
      patient_id: null,
      agent: null,
      result: "Success",
    });
    return rule;
  },

  /** GET /audit */
  listAudit(): Promise<AuditEntry[]> {
    return mockDynamoDBService.listAudit();
  },

  /** GET /agents/status */
  async listAgentStatus(): Promise<AgentServiceStatus[]> {
    const workflows = await mockDynamoDBService.listWorkflows();
    const defs: { agent_id: AgentServiceStatus["agent_id"]; name: string }[] = [
      { agent_id: "ehr-extractor", name: "EHR Extraction" },
      { agent_id: "patient-summary", name: "Clinical Summary" },
      { agent_id: "referral-orchestrator", name: "Referral Orchestration" },
    ];
    return defs.map((def) => {
      const steps = workflows
        .flatMap((w) => w.agent_steps)
        .filter((s) => s.agent_id === def.agent_id);
      return {
        ...def,
        completed: steps.filter((s) => s.status === "Completed").length,
        processing: steps.filter((s) => s.status === "Running").length,
        failed: steps.filter((s) => s.status === "Failed").length,
      };
    });
  },
};