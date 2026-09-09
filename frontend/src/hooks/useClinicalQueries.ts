import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clinicalApi, type CreateReferralInput } from "@/api/clinicalApi";
import type { Referral, Role, WorkflowExecution } from "@/types/clinical";

export const qk = {
  patients: ["patients"] as const,
  patient: (id: string) => ["patients", id] as const,
  ehr: (id: string) => ["patients", id, "ehr"] as const,
  summary: (id: string) => ["patients", id, "summary"] as const,
  patientReferrals: (id: string) => ["patients", id, "referrals"] as const,
  referrals: ["referrals"] as const,
  workflows: ["workflows"] as const,
  workflow: (id: string) => ["workflows", id] as const,
  specialists: ["specialists"] as const,
  rules: ["referral-rules"] as const,
  audit: ["audit"] as const,
  agents: ["agents", "status"] as const,
};

export const patientsQuery = () =>
  queryOptions({ queryKey: qk.patients, queryFn: () => clinicalApi.listPatients() });

export const patientQuery = (id: string) =>
  queryOptions({ queryKey: qk.patient(id), queryFn: () => clinicalApi.getPatient(id) });

export const ehrQuery = (id: string) =>
  queryOptions({ queryKey: qk.ehr(id), queryFn: () => clinicalApi.getPatientEhr(id) });

export const summaryQuery = (id: string) =>
  queryOptions({ queryKey: qk.summary(id), queryFn: () => clinicalApi.getPatientSummary(id) });

export const patientReferralsQuery = (id: string) =>
  queryOptions({ queryKey: qk.patientReferrals(id), queryFn: () => clinicalApi.getPatientReferrals(id) });

export const referralsQuery = () =>
  queryOptions({ queryKey: qk.referrals, queryFn: () => clinicalApi.listReferrals() });

export const workflowsQuery = () =>
  queryOptions({ queryKey: qk.workflows, queryFn: () => clinicalApi.listWorkflows() });

export const workflowQuery = (id: string) =>
  queryOptions({ queryKey: qk.workflow(id), queryFn: () => clinicalApi.getWorkflow(id) });

export const specialistsQuery = () =>
  queryOptions({ queryKey: qk.specialists, queryFn: () => clinicalApi.listSpecialists() });

export const rulesQuery = () =>
  queryOptions({ queryKey: qk.rules, queryFn: () => clinicalApi.listReferralRules() });

export const auditQuery = () =>
  queryOptions({ queryKey: qk.audit, queryFn: () => clinicalApi.listAudit() });

export const agentStatusQuery = () =>
  queryOptions({ queryKey: qk.agents, queryFn: () => clinicalApi.listAgentStatus() });

export function usePatients() {
  return useQuery(patientsQuery());
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>, patientId?: string) {
  queryClient.invalidateQueries({ queryKey: qk.patients });
  queryClient.invalidateQueries({ queryKey: qk.referrals });
  queryClient.invalidateQueries({ queryKey: qk.workflows });
  queryClient.invalidateQueries({ queryKey: qk.audit });
  queryClient.invalidateQueries({ queryKey: qk.agents });
  queryClient.invalidateQueries({ queryKey: qk.specialists });
  if (patientId) {
    queryClient.invalidateQueries({ queryKey: qk.patient(patientId) });
    queryClient.invalidateQueries({ queryKey: qk.ehr(patientId) });
    queryClient.invalidateQueries({ queryKey: qk.summary(patientId) });
    queryClient.invalidateQueries({ queryKey: qk.patientReferrals(patientId) });
  }
}

export function useRunWorkflow(
  patientId: string,
  actor: { name: string; role: Role },
  onUpdate: (execution: WorkflowExecution) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clinicalApi.runWorkflow(patientId, actor, onUpdate),
    onSettled: () => invalidateAll(queryClient, patientId),
  });
}

export function useCreateReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReferralInput) => clinicalApi.createReferral(input),
    onSuccess: (referral) => invalidateAll(queryClient, referral.patient_id),
  });
}

export function useUpdateReferral(actor: { name: string; role: Role }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Referral> }) =>
      clinicalApi.updateReferral(id, patch, actor),
    onSuccess: (referral) => invalidateAll(queryClient, referral.patient_id),
  });
}

export function useToggleRule(actor: { name: string; role: Role }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) =>
      clinicalApi.setRuleEnabled(ruleId, enabled, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.rules });
      queryClient.invalidateQueries({ queryKey: qk.audit });
    },
  });
}