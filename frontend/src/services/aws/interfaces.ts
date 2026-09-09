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

/**
 * Service contracts. Mock implementations live in `src/services/mock/*`.
 * Real AWS implementations (HealthLake, Bedrock, DynamoDB, SNS) can be dropped
 * in behind these same interfaces without touching UI code.
 */

export interface HealthLakeService {
  /** FHIR R4 patient bundle -> flat patient record */
  listPatients(): Promise<Patient[]>;
  getPatient(patientId: string): Promise<Patient | null>;
  /** Executed by the EHR Extractor Agent only. */
  extractEHR(patientId: string): Promise<ExtractedEHR>;
}

export interface BedrockService {
  /** Executed by the Patient Summary Agent only. */
  generateClinicalSummary(ehr: ExtractedEHR): Promise<ClinicalSummary>;
}

export interface DynamoDBService {
  putReferral(referral: Referral): Promise<Referral>;
  updateReferral(referralId: string, patch: Partial<Referral>): Promise<Referral>;
  listReferrals(patientId?: string): Promise<Referral[]>;
  getReferral(referralId: string): Promise<Referral | null>;
  listWorkflows(): Promise<WorkflowExecution[]>;
  getWorkflow(workflowId: string): Promise<WorkflowExecution | null>;
  putWorkflow(workflow: WorkflowExecution): Promise<WorkflowExecution>;
  listSpecialists(): Promise<Specialist[]>;
  listRules(): Promise<ReferralRule[]>;
  setRuleEnabled(ruleId: string, enabled: boolean): Promise<ReferralRule>;
  listAudit(): Promise<AuditEntry[]>;
  putAudit(entry: Omit<AuditEntry, "audit_id" | "timestamp">): Promise<AuditEntry>;
  getSummary(patientId: string): Promise<ClinicalSummary | null>;
  putSummary(summary: ClinicalSummary): Promise<ClinicalSummary>;
  getEHR(patientId: string): Promise<ExtractedEHR | null>;
  putEHR(ehr: ExtractedEHR): Promise<ExtractedEHR>;
}

export interface NotificationService {
  /** Amazon SNS topic publish for specialist notification. */
  publishReferralNotification(referral: Referral): Promise<{ messageId: string }>;
}