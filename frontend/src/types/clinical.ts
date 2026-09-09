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

export type Role = "Clinician" | "Care Coordinator";

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
  role: Role;
  action: string;
  patient_id: string | null;
  agent: string | null;
  timestamp: string;
  result: "Success" | "Failed" | "Info";
}

export interface AgentServiceStatus {
  agent_id: AgentId;
  name: string;
  completed: number;
  processing: number;
  failed: number;
}