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
  queueAll: ["queue", "all"] as const,
  queueDoctor: (id: string) => ["queue", "doctor", id] as const,
  triageLatest: (id: string) => ["patients", id, "triage", "latest"] as const,
  consultation: (id: string) => ["consultations", id] as const,
  appointments: (rangeKey: string) => ["appointments", rangeKey] as const,
  clinicDoctors: ["appointments", "doctors"] as const,
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

export const queueAllQuery = () =>
  queryOptions({
    queryKey: qk.queueAll,
    queryFn: () => clinicalApi.getAllQueues(),
    refetchInterval: 15_000,
  });

export const doctorQueueQuery = (doctorId: string) =>
  queryOptions({
    queryKey: qk.queueDoctor(doctorId),
    queryFn: () => clinicalApi.getDoctorQueue(doctorId),
    enabled: Boolean(doctorId),
    refetchInterval: 15_000,
  });

export const latestTriageQuery = (patientId: string) =>
  queryOptions({
    queryKey: qk.triageLatest(patientId),
    queryFn: () => clinicalApi.getLatestTriage(patientId),
    enabled: Boolean(patientId),
  });

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
  queryClient.invalidateQueries({ queryKey: qk.queueAll });
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

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof clinicalApi.createPatient>[0]) =>
      clinicalApi.createPatient(input),
    onSuccess: (patient) => invalidateAll(queryClient, patient.patient_id),
  });
}

export function useCheckinPatient(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      chief_complaint: string;
      vitals?: Record<string, unknown> | null;
      actor_name: string;
      actor_role: string;
    }) => clinicalApi.checkinPatient(patientId, input),
    onSuccess: () => invalidateAll(queryClient, patientId),
  });
}

export function useConsultationFeeQuote(patientId: string) {
  return useQuery({
    queryKey: ["payments", "fee-quote", patientId] as const,
    queryFn: () => clinicalApi.getConsultationFeeQuote(patientId),
    enabled: Boolean(patientId),
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clinicalApi.createPayment.bind(clinicalApi),
    onSuccess: (payment) => invalidateAll(queryClient, payment.patient_id),
  });
}

export function useRazorpayConfig() {
  return useQuery({
    queryKey: ["payments", "razorpay", "config"] as const,
    queryFn: () => clinicalApi.getRazorpayConfig(),
    staleTime: 60_000,
  });
}

export function useCreateRazorpayOrder() {
  return useMutation({
    mutationFn: clinicalApi.createRazorpayOrder.bind(clinicalApi),
  });
}

export function useVerifyRazorpayPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clinicalApi.verifyRazorpayPayment.bind(clinicalApi),
    onSuccess: (payment) => invalidateAll(queryClient, payment.patient_id),
  });
}

export function useCreateUpiQr() {
  return useMutation({
    mutationFn: clinicalApi.createUpiQr.bind(clinicalApi),
  });
}

export function useSyncUpiQrPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => clinicalApi.syncUpiQrPayment(paymentId),
    onSuccess: (payment) => {
      if (payment.status === "Completed") {
        invalidateAll(queryClient, payment.patient_id);
      }
    },
  });
}

export function useUploadAndScribe(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { blob: Blob; name: string }) => {
      const uploaded = await clinicalApi.uploadConsultation(patientId, input.blob, input.name);
      return clinicalApi.scribeConsultation(uploaded.consultation_id);
    },
    onSuccess: (consultation) => {
      invalidateAll(queryClient, patientId);
      if (consultation.consultation_id) {
        queryClient.invalidateQueries({ queryKey: qk.consultation(consultation.consultation_id) });
      }
    },
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

export const clinicDoctorsQuery = () =>
  queryOptions({
    queryKey: qk.clinicDoctors,
    queryFn: () => clinicalApi.listClinicDoctors(),
    staleTime: 60_000,
  });

export const appointmentsQuery = (range: { from: string; to: string; doctor_id?: string }) =>
  queryOptions({
    queryKey: qk.appointments(`${range.from}|${range.to}|${range.doctor_id ?? "all"}`),
    queryFn: () =>
      clinicalApi.listAppointments({
        from: range.from,
        to: range.to,
        doctor_id: range.doctor_id,
      }),
    refetchInterval: 30_000,
  });

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clinicalApi.createAppointment.bind(clinicalApi),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: qk.audit });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Parameters<typeof clinicalApi.updateAppointment>[1];
    }) => clinicalApi.updateAppointment(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: qk.audit });
    },
  });
}