/**
 * API configuration. `VITE_API_BASE_URL` can override the base URL; by default
 * the Vite dev proxy at `/api` forwards to the FastAPI backend on port 8000.
 */
export const API_BASE_URL = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api";

/** Set to true to fall back to the in-browser mock service layer (offline dev). */
export const USE_MOCK_BACKEND = false;

export const ENVIRONMENT_LABEL =
  (import.meta.env["VITE_ENVIRONMENT_LABEL"] as string | undefined) ?? "Demo / Synthetic Data";

export const AI_DISCLAIMER =
  "AI-generated clinical summaries are for demonstration and decision-support purposes only. Clinicians must independently verify all information.";

/** REST contract exposed by API Gateway; mirrored by the mock client. */
export const ENDPOINTS = {
  authLogin: "/auth/login",
  authSignup: "/auth/signup",
  authMe: "/auth/me",
  patients: "/patients",
  patient: (id: string) => `/patients/${id}`,
  patientEhr: (id: string) => `/patients/${id}/ehr`,
  patientSummary: (id: string) => `/patients/${id}/summary`,
  patientReferrals: (id: string) => `/patients/${id}/referrals`,
  runWorkflow: (id: string) => `/patients/${id}/workflow/run`,
  streamWorkflow: (id: string) => `/patients/${id}/workflow/stream`,
  patientCheckin: (id: string) => `/patients/${id}/checkin`,
  patientTriageLatest: (id: string) => `/patients/${id}/triage/latest`,
  consultations: "/consultations",
  consultationsUpload: "/consultations/upload",
  consultation: (id: string) => `/consultations/${id}`,
  consultationScribe: (id: string) => `/consultations/${id}/scribe`,
  consultationCds: (id: string) => `/consultations/${id}/cds`,
  encounters: "/encounters",
  encounter: (id: string) => `/encounters/${id}`,
  encounterFinalize: (id: string) => `/encounters/${id}/finalize`,
  encounterPrescriptionPdf: (id: string) => `/encounters/${id}/prescription/pdf`,
  payments: "/payments",
  payment: (id: string) => `/payments/${id}`,
  razorpayConfig: "/payments/razorpay/config",
  razorpayOrder: "/payments/razorpay/order",
  razorpayVerify: "/payments/razorpay/verify",
  queue: "/queue",
  queueAll: "/queue/all",
  referrals: "/referrals",
  referral: (id: string) => `/referrals/${id}`,
  workflows: "/workflows",
  workflow: (id: string) => `/workflows/${id}`,
  specialists: "/specialists",
  referralRules: "/referral-rules",
  agentsStatus: "/agents/status",
  audit: "/audit",
} as const;