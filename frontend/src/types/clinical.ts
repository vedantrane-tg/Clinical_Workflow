export type Gender = "Male" | "Female" | "Other";

export type WorkflowStatus =
  | "Not Started"
  | "Queued"
  | "Extracting"
  | "Summarizing"
  | "Orchestrating Referral"
  | "Completed"
  | "Failed";

export type AgentId = "ehr-extractor" | "patient-summary" | "referral-orchestrator";

export type AgentStatus = "Waiting" | "Running" | "Completed" | "Failed";

export type Severity = "High" | "Medium" | "Low";

export type ReferralStatus =
  | "Pending"
  | "Created"
  | "Contacted"
  | "Scheduled"
  | "Completed"
  | "Cancelled";

export type SpecialistType =
  | "Endocrinologist"
  | "Nephrologist"
  | "Cardiologist"
  | "Pulmonologist"
  | "Other";

// export type Role = "Clinician" | "Care Coordinator";
export type Role = "Admin" | "Receptionist" | "Doctor";

export interface Condition {
  name: string;
  code: string;
  codeSystem: "ICD-10" | "SNOMED CT";
  status: "Active" | "Resolved" | "Remission";
  onsetDate: string;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  status: "Active" | "Stopped" | "On Hold";
  startDate: string;
}

export interface Encounter {
  date: string;
  type: string;
  provider: string;
  reason: string;
}

export interface LabResult {
  test: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: "NORMAL" | "HIGH" | "LOW" | "CRITICAL";
  date: string;
}

export interface Demographics {
  patientId: string;
  name: string;
  age: number;
  gender: Gender;
  dateOfBirth: string;
}

export interface Patient {
  patient_id: string;
  name: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  date_of_birth: string;
  gender: Gender;
  age: number;
  risk: Severity;
  conditions: Condition[];
  medications: Medication[];
  encounters: Encounter[];
  labs: LabResult[];
  workflow_status: WorkflowStatus;
  last_encounter: string;
  issues_count: number;
  referrals_count: number;
  chief_complaint?: string | null;
  assigned_doctor_id?: string | null;
  queue_status?: string;
  queue_position?: number | null;
  checked_in_at?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  insurance_id?: string | null;
  address?: string | null;
  pincode?: string | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  guardian_phone?: string | null;
  guardian_email?: string | null;
}

export interface ExtractedEHR {
  patient_id: string;
  demographics: Demographics;
  conditions: Condition[];
  medications: Medication[];
  encounters: Encounter[];
  labs: LabResult[];
  extracted_at: string;
  source: string;
}

export interface FlaggedIssue {
  issue_id: string;
  patient_id: string;
  severity: Severity;
  issue: string;
  evidence: string;
  source: string;
  detected_by: string;
  rule_id: string | null;
  rule_expression: string | null;
  recommended_specialist: SpecialistType;
  referral_status: ReferralStatus | "Not Referred";
}

export interface ClinicalSummary {
  patient_id: string;
  summary: string;
  sections: { heading: string; body: string }[];
  concerns: string[];
  abnormal_labs: LabResult[];
  medication_conflicts: string[];
  recommended_actions: string[];
  issues: FlaggedIssue[];
  generated_at: string;
  model: string;
}

export interface Referral {
  referral_id: string;
  patient_id: string;
  patient_name: string;
  issue: string;
  specialist_type: SpecialistType;
  specialist_id: string | null;
  specialist_name: string | null;
  priority: Severity;
  status: ReferralStatus;
  created_at: string;
  agent_notes: string;
  created_by: string;
}

export interface AgentStep {
  agent_id: AgentId;
  name: string;
  status: AgentStatus;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  output_summary: string | null;
  output: unknown;
  error: string | null;
}

export interface WorkflowExecution {
  workflow_id: string;
  patient_id: string;
  patient_name: string;
  status: WorkflowStatus;
  current_agent: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  agent_steps: AgentStep[];
  error: string | null;
}

export interface Specialist {
  specialist_id: string;
  name: string;
  specialty: SpecialistType;
  facility: string;
  location: string;
  availability: "Available" | "Limited" | "Unavailable";
  active_referrals: number;
}

export interface ReferralRule {
  rule_id: string;
  condition: string;
  trigger: string;
  expression: {
    type: "lab" | "condition-lab";
    test?: string;
    operator?: ">" | "<" | ">=";
    threshold?: number;
    condition?: string;
  };
  specialist: SpecialistType;
  priority: Severity;
  enabled: boolean;
}

export interface AuditEntry {
  audit_id: string;
  user: string;
  role: string;
  action: string;
  patient_id: string | null;
  agent: string | null;
  timestamp: string;
  result: "Success" | "Failed" | "Info" | string;
}

export interface TriageResult {
  triage_id: string;
  patient_id: string;
  chief_complaint: string;
  recommended_specialty: string;
  recommended_doctor_id: string | null;
  recommended_doctor_name: string | null;
  acuity_level: string;
  pre_visit_brief: string;
  brief_sections: { heading: string; body: string }[];
  confidence_score: number;
  model: string;
  created_at: string;
}

export interface Payment {
  payment_id: string;
  patient_id: string;
  encounter_id: string | null;
  amount: number;
  currency: string;
  payment_type: string;
  payment_method: string;
  status: string;
  transaction_ref: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ConsultationFeeQuote {
  patient_id: string;
  amount: number;
  payment_type: string;
  is_follow_up: boolean;
  label: string;
  last_visit_at: string | null;
  reason: string;
  currency: string;
  new_consultation_fee: number;
  follow_up_fee: number;
  follow_up_window_months: number;
}

export interface QueuePatient {
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  chief_complaint: string | null;
  assigned_doctor_id: string | null;
  queue_status: string;
  queue_position: number | null;
  checked_in_at: string | null;
  risk: string;
  acuity_hint: string | null;
  contact_phone: string | null;
}

export interface DoctorQueue {
  doctor_id: string;
  doctor_name: string;
  specialty: string;
  patients: QueuePatient[];
}

export interface SoapNote {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  key_findings?: string[];
  mentioned_diagnoses?: string[];
  mentioned_medications?: string[];
  model?: string;
}

export interface Consultation {
  consultation_id: string;
  patient_id: string | null;
  audio_filename: string;
  status: string;
  transcript: string | null;
  key_points: string[] | null;
  pdf_path: string | null;
  created_at: string;
  soap_note: SoapNote | null;
  encounter_status: string;
}

export interface Encounter {
  encounter_id: string;
  patient_id: string;
  consultation_id: string | null;
  triage_id: string | null;
  doctor_id: string;
  doctor_name: string;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  suggested_labs: Record<string, unknown>[];
  suggested_medications: Record<string, unknown>[];
  suggested_icd_codes: Record<string, unknown>[];
  suggested_referrals: Record<string, unknown>[];
  approved_labs: Record<string, unknown>[] | null;
  approved_medications: Record<string, unknown>[] | null;
  approved_icd_codes: Record<string, unknown>[] | null;
  approved_referrals: Record<string, unknown>[] | null;
  prescription: Record<string, unknown>[] | null;
  prescription_pdf_path: string | null;
  status: string;
  finalized_at: string | null;
  finalized_by: string | null;
  created_at: string;
}

export interface StaffUser {
  user_id: string;
  full_name: string;
  email: string;
  role: "Receptionist" | "Doctor";
  specialty: string | null;
  is_active: boolean;
}

export interface AgentServiceStatus {
  agent_id: AgentId;
  name: string;
  completed: number;
  processing: number;
  failed: number;
}

export type AppointmentStatus =
  | "Scheduled"
  | "Checked In"
  | "Completed"
  | "Cancelled"
  | "No Show";

export type AppointmentVisitType = "Consultation" | "Follow-up" | "New Visit" | "Procedure";

export interface ClinicDoctor {
  doctor_id: string;
  name: string;
  specialty: string | null;
  role: string;
}

export interface Appointment {
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  starts_at: string;
  duration_minutes: number;
  visit_type: AppointmentVisitType | string;
  reason: string | null;
  status: AppointmentStatus | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}