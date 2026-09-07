import { REFERRAL_RULES } from "@/data/referralRules";
import { SPECIALISTS } from "@/data/specialists";
import { SYNTHETIC_PATIENTS } from "@/data/patients";
import type {
  AuditEntry,
  ClinicalSummary,
  ExtractedEHR,
  Patient,
  Referral,
  ReferralRule,
  Specialist,
  WorkflowExecution,
} from "@/types/clinical";

interface ClinicalStore {
  patients: Patient[];
  referrals: Referral[];
  workflows: WorkflowExecution[];
  audit: AuditEntry[];
  specialists: Specialist[];
  rules: ReferralRule[];
  summaries: Record<string, ClinicalSummary>;
  ehr: Record<string, ExtractedEHR>;
  counters: { referral: number; workflow: number; audit: number };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seed(): ClinicalStore {
  return {
    patients: clone(SYNTHETIC_PATIENTS),
    referrals: [],
    workflows: [],
    audit: [
      {
        audit_id: "AUD-0001",
        user: "system",
        role: "Clinician",
        action: "Environment initialised with synthetic FHIR dataset",
        patient_id: null,
        agent: null,
        timestamp: new Date().toISOString(),
        result: "Info",
      },
    ],
    specialists: clone(SPECIALISTS),
    rules: clone(REFERRAL_RULES),
    summaries: {},
    ehr: {},
    counters: { referral: 3000, workflow: 5000, audit: 1 },
  };
}

const globalRef = globalThis as unknown as { __clinicalStore?: ClinicalStore };

export function getStore(): ClinicalStore {
  if (!globalRef.__clinicalStore) globalRef.__clinicalStore = seed();
  return globalRef.__clinicalStore;
}

export function resetStore(): void {
  globalRef.__clinicalStore = seed();
}

export function nextId(kind: "referral" | "workflow" | "audit"): string {
  const store = getStore();
  store.counters[kind] += 1;
  const n = store.counters[kind];
  if (kind === "referral") return `REF-${n}`;
  if (kind === "workflow") return `WF-${n}`;
  return `AUD-${String(n).padStart(4, "0")}`;
}

export { clone };