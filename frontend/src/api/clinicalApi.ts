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
import { API_BASE_URL, ENDPOINTS } from "./config";

/**
 * Single abstraction the UI talks to. Every function maps 1:1 to a REST route
 * served by the FastAPI backend. UI components must never call services directly.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiFetchNullable<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateReferralInput {
  patient_id: string;
  issue: string;
  specialist_type: SpecialistType;
  specialist_id: string;
  priority: Severity;
  notes: string;
  actor: { name: string; role: Role };
}

// ─── API Client ─────────────────────────────────────────────────────────────

export const clinicalApi = {
  /** GET /patients */
  listPatients(): Promise<Patient[]> {
    return apiFetch<Patient[]>(ENDPOINTS.patients);
  },

  /** GET /patients/{id} */
  getPatient(id: string): Promise<Patient | null> {
    return apiFetchNullable<Patient>(ENDPOINTS.patient(id));
  },

  /** GET /patients/{id}/ehr */
  getPatientEhr(id: string): Promise<ExtractedEHR | null> {
    return apiFetchNullable<ExtractedEHR>(ENDPOINTS.patientEhr(id));
  },

  /** GET /patients/{id}/summary */
  getPatientSummary(id: string): Promise<ClinicalSummary | null> {
    return apiFetchNullable<ClinicalSummary>(ENDPOINTS.patientSummary(id));
  },

  /** GET /referrals filtered by patient_id (client-side filter until backend adds query param) */
  async getPatientReferrals(id: string): Promise<Referral[]> {
    const all = await apiFetch<Referral[]>(ENDPOINTS.referrals);
    return all.filter((r) => r.patient_id === id);
  },

  /** POST /patients/{id}/workflow/stream (with fallback to /run) */
  async runWorkflow(
    id: string,
    actor: { name: string; role: Role },
    onUpdate?: (execution: WorkflowExecution) => void,
  ): Promise<WorkflowExecution> {
    try {
      const res = await fetch(`${API_BASE_URL}${ENDPOINTS.streamWorkflow(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Stream request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let latestExecution: WorkflowExecution | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const snapshot = JSON.parse(jsonStr) as WorkflowExecution;
            latestExecution = snapshot;
            onUpdate?.(snapshot);
          } catch (e) {
            console.warn("[clinicalApi] Failed to parse SSE message:", e);
          }
        }
      }

      if (latestExecution) {
        return latestExecution;
      }
    } catch (err) {
      console.warn("[clinicalApi] Streaming failed, falling back to synchronous run:", err);
    }

    // Fallback if SSE streaming failed or produced no execution
    return apiFetch<WorkflowExecution>(ENDPOINTS.runWorkflow(id), {
      method: "POST",
      body: JSON.stringify({ actor }),
    });
  },

  /** GET /referrals */
  listReferrals(): Promise<Referral[]> {
    return apiFetch<Referral[]>(ENDPOINTS.referrals);
  },

  /** GET /referrals/{id} */
  getReferral(id: string): Promise<Referral | null> {
    return apiFetchNullable<Referral>(ENDPOINTS.referral(id));
  },

  /** POST /referrals */
  createReferral(input: CreateReferralInput): Promise<Referral> {
    return apiFetch<Referral>(ENDPOINTS.referrals, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** PATCH /referrals/{id} — override / status change */
  updateReferral(
    id: string,
    patch: Partial<Pick<Referral, "status" | "specialist_id" | "specialist_name" | "priority" | "agent_notes">>,
    actor: { name: string; role: Role },
  ): Promise<Referral> {
    return apiFetch<Referral>(ENDPOINTS.referral(id), {
      method: "PATCH",
      body: JSON.stringify({ ...patch, actor }),
    });
  },

  /** GET /workflows */
  listWorkflows(): Promise<WorkflowExecution[]> {
    return apiFetch<WorkflowExecution[]>(ENDPOINTS.workflows);
  },

  /** GET /workflows/{id} — TODO: add backend endpoint; for now uses list + filter */
  async getWorkflow(id: string): Promise<WorkflowExecution | null> {
    const all = await apiFetch<WorkflowExecution[]>(ENDPOINTS.workflows);
    return all.find((w) => w.workflow_id === id) ?? null;
  },

  /** GET /specialists */
  listSpecialists(): Promise<Specialist[]> {
    return apiFetch<Specialist[]>(ENDPOINTS.specialists);
  },

  /** GET /referral-rules */
  listReferralRules(): Promise<ReferralRule[]> {
    return apiFetch<ReferralRule[]>(ENDPOINTS.referralRules);
  },

  /** PATCH /referral-rules/{id} — TODO: add backend endpoint */
  async setRuleEnabled(_ruleId: string, _enabled: boolean, _actor: { name: string; role: Role }) {
    // Stub: backend doesn't have this endpoint yet.
    // Return a fake success so the UI doesn't crash.
    console.warn("[clinicalApi] setRuleEnabled: backend endpoint not implemented yet");
    const rules = await apiFetch<ReferralRule[]>(ENDPOINTS.referralRules);
    const rule = rules.find((r) => r.rule_id === _ruleId);
    if (!rule) throw new Error(`Rule ${_ruleId} not found`);
    return { ...rule, enabled: _enabled };
  },

  /** GET /audit */
  listAudit(): Promise<AuditEntry[]> {
    return apiFetch<AuditEntry[]>(ENDPOINTS.audit);
  },

  /** GET /agents/status — computed client-side from workflow data (no backend endpoint) */
  async listAgentStatus(): Promise<AgentServiceStatus[]> {
    const workflows = await apiFetch<WorkflowExecution[]>(ENDPOINTS.workflows);
    const defs: { agent_id: AgentServiceStatus["agent_id"]; name: string }[] = [
      { agent_id: "ehr-extractor", name: "EHR Extraction" },
      { agent_id: "patient-summary", name: "Clinical Summary" },
      { agent_id: "referral-orchestrator", name: "Referral Orchestration" },
    ];
    return defs.map((def) => {
      const steps = workflows
        .flatMap((w) => w.agent_steps ?? [])
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