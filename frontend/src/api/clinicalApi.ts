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
  TriageResult,
  Payment,
  DoctorQueue,
  QueuePatient,
  Consultation,
  Encounter,
  WorkflowExecution,
  Appointment,
  ClinicDoctor,
  AppointmentStatus,
  StaffUser,   
  ConsultationFeeQuote,
} from "@/types/clinical";
import { API_BASE_URL, ENDPOINTS } from "./config";

const TOKEN_KEY = "clinicalflow.auth.token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}
/**
 * Single abstraction the UI talks to. Every function maps 1:1 to a REST route
 * served by the FastAPI backend. UI components must never call services directly.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatApiError(status: number, text: string): Error {
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string") {
      return new Error(parsed.detail);
    }
    if (Array.isArray(parsed.detail)) {
      const msgs = parsed.detail
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as { msg?: string };
          const msg = row.msg?.replace(/^Value error,\s*/i, "") ?? null;
          return msg;
        })
        .filter(Boolean);
      if (msgs.length) return new Error(msgs.join("; "));
    }
  } catch {
    // fall through
  }
  return new Error(`API ${status}: ${text}`);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw formatApiError(res.status, text);
  }
  return res.json() as Promise<T>;
}

async function apiFetchNullable<T>(path: string): Promise<T | null> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export type AuthUserDto = {
  user_id: string;
  full_name: string;
  email: string;
  role: Role;
  specialty: string | null;
  is_active: boolean;
};

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
  /** POST /auth/login */
  login(email: string, password: string) {
    return apiFetch<{ access_token: string; token_type: string; user: AuthUserDto }>(
      ENDPOINTS.authLogin,
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
  },

  /** POST /auth/signup */
  signup(input: {
    full_name: string;
    email: string;
    password: string;
    role: Role;
    specialty?: string | null;
  }) {
    return apiFetch<AuthUserDto>(ENDPOINTS.authSignup, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** GET /auth/me */
  me() {
    return apiFetch<AuthUserDto>(ENDPOINTS.authMe);
  },

  /** POST /patients */
  createPatient(input: {
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    date_of_birth: string;
    gender: string;
    contact_phone: string;
    contact_email?: string | null;
    insurance_id?: string | null;
    address: string;
    pincode: string;
    guardian_name?: string | null;
    guardian_relationship?: string | null;
    guardian_phone?: string | null;
    guardian_email?: string | null;
    conditions?: Record<string, unknown>[];
    medications?: Record<string, unknown>[];
  }): Promise<Patient> {
    return apiFetch<Patient>(ENDPOINTS.patients, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** POST /patients/{id}/checkin */
  checkinPatient(
    patientId: string,
    input: {
      chief_complaint: string;
      vitals?: Record<string, unknown> | null;
      actor_name: string;
      actor_role: string;
    },
  ): Promise<TriageResult> {
    return apiFetch<TriageResult>(ENDPOINTS.patientCheckin(patientId), {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** GET /patients/{id}/triage/latest */
  getLatestTriage(patientId: string): Promise<TriageResult | null> {
    return apiFetchNullable<TriageResult>(ENDPOINTS.patientTriageLatest(patientId));
  },

  /** POST /consultations/upload */
  uploadConsultation(patientId: string, file: File | Blob, filename = "consult.webm") {
    const form = new FormData();
    form.append("patient_id", patientId);
    form.append("file", file, filename);
    return apiUpload<Consultation>(ENDPOINTS.consultationsUpload, form);
  },

  /** POST /consultations/{id}/scribe */
  scribeConsultation(consultationId: string): Promise<Consultation> {
    return apiFetch<Consultation>(ENDPOINTS.consultationScribe(consultationId), {
      method: "POST",
    });
  },

  /** GET /consultations/{id} */
  getConsultation(consultationId: string): Promise<Consultation | null> {
    return apiFetchNullable<Consultation>(ENDPOINTS.consultation(consultationId));
  },

  /** POST /consultations/{id}/cds */
  runCds(
    consultationId: string,
    actor: { actor_name: string; actor_role: string },
  ): Promise<Encounter> {
    return apiFetch<Encounter>(ENDPOINTS.consultationCds(consultationId), {
      method: "POST",
      body: JSON.stringify(actor),
    });
  },

  /** POST /encounters/{id}/finalize */
  finalizeEncounter(
    encounterId: string,
    input: {
      approved_labs: Record<string, unknown>[];
      approved_medications: Record<string, unknown>[];
      approved_icd_codes: Record<string, unknown>[];
      approved_referrals: Record<string, unknown>[];
      prescription: Record<string, unknown>[];
      doctor_notes?: string | null;
      actor_name: string;
      actor_role: string;
    },
  ): Promise<Encounter> {
    return apiFetch<Encounter>(ENDPOINTS.encounterFinalize(encounterId), {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** POST /encounters/{id}/prescription/pdf — generate and download */
  async downloadPrescriptionPdf(
    encounterId: string,
    input: {
      prescription: Record<string, unknown>[];
      actor_name: string;
    },
  ): Promise<void> {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.encounterPrescriptionPdf(encounterId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw formatApiError(res.status, text);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${encounterId}-prescription.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  /** POST /payments — Cash / Insurance only (server sets consultation/follow-up fee) */
  createPayment(input: {
    patient_id: string;
    amount?: number;
    payment_type?: string;
    payment_method: string;
    encounter_id?: string | null;
    actor_name?: string;
    actor_role?: string;
  }): Promise<Payment> {
    return apiFetch<Payment>(ENDPOINTS.payments, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** GET /payments/fee-quote/{patientId} */
  getConsultationFeeQuote(patientId: string): Promise<ConsultationFeeQuote> {
    return apiFetch<ConsultationFeeQuote>(ENDPOINTS.paymentFeeQuote(patientId));
  },

  /** GET /payments/razorpay/config */
  getRazorpayConfig(): Promise<{ enabled: boolean; key_id: string | null }> {
    return apiFetch(ENDPOINTS.razorpayConfig);
  },

  /** POST /payments/razorpay/order */
  createRazorpayOrder(input: {
    patient_id: string;
    amount?: number;
    payment_type?: string;
    payment_method: "Card" | "UPI";
    encounter_id?: string | null;
    actor_name?: string;
    actor_role?: string;
  }): Promise<{
    payment_id: string;
    order_id: string;
    amount: number;
    amount_paise: number;
    currency: string;
    key_id: string;
    patient_id: string;
    payment_method: string;
  }> {
    return apiFetch(ENDPOINTS.razorpayOrder, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** POST /payments/razorpay/verify */
  verifyRazorpayPayment(input: {
    payment_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    actor_name?: string;
    actor_role?: string;
  }): Promise<Payment> {
    return apiFetch<Payment>(ENDPOINTS.razorpayVerify, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** POST /payments/razorpay/upi-qr */
  createUpiQr(input: {
    patient_id: string;
    amount?: number;
    payment_type?: string;
    encounter_id?: string | null;
    actor_name?: string;
    actor_role?: string;
  }): Promise<{
    payment_id: string;
    qr_id: string;
    image_url: string;
    amount: number;
    amount_paise: number;
    currency: string;
    patient_id: string;
    status: string;
  }> {
    return apiFetch(ENDPOINTS.razorpayUpiQr, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** POST /payments/razorpay/upi-qr/{id}/sync */
  syncUpiQrPayment(paymentId: string): Promise<Payment> {
    return apiFetch<Payment>(ENDPOINTS.razorpayUpiQrSync(paymentId), {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  /** GET /queue?doctor_id= */
  getDoctorQueue(doctorId: string): Promise<QueuePatient[]> {
    return apiFetch<QueuePatient[]>(`${ENDPOINTS.queue}?doctor_id=${encodeURIComponent(doctorId)}`);
  },

  /** GET /queue/all */
  getAllQueues(): Promise<DoctorQueue[]> {
    return apiFetch<DoctorQueue[]>(ENDPOINTS.queueAll);
  },

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
      const token = getAuthToken();
      const res = await fetch(`${API_BASE_URL}${ENDPOINTS.streamWorkflow(id)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

  /** GET /appointments/doctors */
  listClinicDoctors(): Promise<ClinicDoctor[]> {
    return apiFetch<ClinicDoctor[]>(ENDPOINTS.appointmentDoctors);
  },

  /** GET /appointments */
  listAppointments(params?: {
    from?: string;
    to?: string;
    doctor_id?: string;
    status?: string;
    patient_id?: string;
  }): Promise<Appointment[]> {
    const qs = new URLSearchParams();
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.doctor_id) qs.set("doctor_id", params.doctor_id);
    if (params?.status) qs.set("status", params.status);
    if (params?.patient_id) qs.set("patient_id", params.patient_id);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<Appointment[]>(`${ENDPOINTS.appointments}${suffix}`);
  },

  /** POST /appointments */
  createAppointment(input: {
    patient_id: string;
    doctor_id: string;
    starts_at: string;
    duration_minutes?: number;
    visit_type?: string;
    reason?: string | null;
    notes?: string | null;
    actor_name: string;
    actor_role: Role;
  }): Promise<Appointment> {
    return apiFetch<Appointment>(ENDPOINTS.appointments, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** PATCH /appointments/{id} */
  updateAppointment(
    id: string,
    patch: {
      doctor_id?: string;
      starts_at?: string;
      duration_minutes?: number;
      visit_type?: string;
      reason?: string | null;
      notes?: string | null;
      status?: AppointmentStatus | string;
      actor_name: string;
      actor_role: Role;
    },
  ): Promise<Appointment> {
    return apiFetch<Appointment>(ENDPOINTS.appointment(id), {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  listStaff(): Promise<StaffUser[]> {
    return apiFetch<StaffUser[]>(ENDPOINTS.adminUsers);
  },

  createStaff(input: {
    full_name: string;
    email: string;
    password: string;
    role: "Receptionist" | "Doctor";
    specialty?: string | null;
  }): Promise<StaffUser> {
    return apiFetch<StaffUser>(ENDPOINTS.adminUsers, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateStaff(
    id: string,
    patch: {
      full_name?: string;
      email?: string;
      password?: string;
      role?: "Receptionist" | "Doctor";
      specialty?: string | null;
      is_active?: boolean;
    },
  ): Promise<StaffUser> {
    return apiFetch<StaffUser>(ENDPOINTS.adminUser(id), {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  updatePatient(
    id: string,
    patch: {
      first_name?: string;
      middle_name?: string | null;
      last_name?: string;
      contact_phone?: string | null;
      contact_email?: string | null;
      address?: string | null;
      pincode?: string | null;
      guardian_name?: string | null;
      guardian_relationship?: string | null;
      guardian_phone?: string | null;
      guardian_email?: string | null;
      actor_name?: string;
      actor_role?: Role;
    },
  ): Promise<Patient> {
    return apiFetch<Patient>(ENDPOINTS.patient(id), {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  deleteStaff(id: string): Promise<void> {
    return apiFetch<void>(ENDPOINTS.adminUser(id), { method: "DELETE" });
  },

  deletePatient(id: string): Promise<void> {
    return apiFetch<void>(ENDPOINTS.patient(id), { method: "DELETE" });
  },

  getPatientHistory(id: string): Promise<{
    patient_id: string;
    audit_logs: {
      audit_id: string;
      user: string;
      role: string;
      action: string;
      agent: string | null;
      timestamp: string | null;
      result: string;
    }[];
    appointments: {
      appointment_id: string;
      doctor_name: string;
      starts_at: string | null;
      duration_minutes: number;
      visit_type: string;
      reason: string | null;
      status: string;
      notes: string | null;
    }[];
    encounters: {
      encounter_id: string;
      doctor_name: string;
      status: string;
      soap_subjective: string | null;
      soap_objective: string | null;
      soap_assessment: string | null;
      soap_plan: string | null;
      finalized_at: string | null;
      created_at: string | null;
      approved_medications: Record<string, unknown>[];
      approved_labs: Record<string, unknown>[];
      approved_icd_codes: Record<string, unknown>[];
    }[];
  }> {
    return apiFetch(ENDPOINTS.patientHistory(id));
  },
};