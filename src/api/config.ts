/**
 * API configuration. When `VITE_API_BASE_URL` is provided the app is expected
 * to talk to Amazon API Gateway; until then the mock service layer is used.
 */
export const API_BASE_URL = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "";

export const USE_MOCK_BACKEND = API_BASE_URL === "";

export const ENVIRONMENT_LABEL =
  (import.meta.env["VITE_ENVIRONMENT_LABEL"] as string | undefined) ?? "Demo / Synthetic Data";

export const AI_DISCLAIMER =
  "AI-generated clinical summaries are for demonstration and decision-support purposes only. Clinicians must independently verify all information.";

/** REST contract exposed by API Gateway; mirrored by the mock client. */
export const ENDPOINTS = {
  patients: "/patients",
  patient: (id: string) => `/patients/${id}`,
  patientEhr: (id: string) => `/patients/${id}/ehr`,
  patientSummary: (id: string) => `/patients/${id}/summary`,
  patientReferrals: (id: string) => `/patients/${id}/referrals`,
  runWorkflow: (id: string) => `/patients/${id}/workflow/run`,
  referrals: "/referrals",
  referral: (id: string) => `/referrals/${id}`,
  workflows: "/workflows",
  workflow: (id: string) => `/workflows/${id}`,
  specialists: "/specialists",
  referralRules: "/referral-rules",
  agentsStatus: "/agents/status",
  audit: "/audit",
} as const;