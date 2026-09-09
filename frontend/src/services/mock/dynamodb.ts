import type { DynamoDBService } from "@/services/aws/interfaces";
import type { AuditEntry } from "@/types/clinical";
import { clone, getStore, nextId } from "./store";
import { delay } from "./latency";

/** mockDynamoDBService() — replace with dynamoDBService() backed by DynamoDB tables. */
export const mockDynamoDBService: DynamoDBService = {
  async putReferral(referral) {
    await delay(90);
    const store = getStore();
    store.referrals = [referral, ...store.referrals];
    const patient = store.patients.find((p) => p.patient_id === referral.patient_id);
    if (patient) patient.referrals_count = store.referrals.filter((r) => r.patient_id === patient.patient_id).length;
    const specialist = store.specialists.find((s) => s.specialist_id === referral.specialist_id);
    if (specialist) specialist.active_referrals += 1;
    return clone(referral);
  },

  async updateReferral(referralId, patch) {
    await delay(80);
    const store = getStore();
    const index = store.referrals.findIndex((r) => r.referral_id === referralId);
    if (index === -1) throw new Error(`Referral ${referralId} not found`);
    const updated = { ...store.referrals[index]!, ...patch };
    store.referrals[index] = updated;
    return clone(updated);
  },

  async listReferrals(patientId) {
    await delay(70);
    const all = getStore().referrals;
    return clone(patientId ? all.filter((r) => r.patient_id === patientId) : all);
  },

  async getReferral(referralId) {
    await delay(50);
    const found = getStore().referrals.find((r) => r.referral_id === referralId);
    return found ? clone(found) : null;
  },

  async listWorkflows() {
    await delay(70);
    return clone(getStore().workflows);
  },

  async getWorkflow(workflowId) {
    await delay(50);
    const found = getStore().workflows.find((w) => w.workflow_id === workflowId);
    return found ? clone(found) : null;
  },

  async putWorkflow(workflow) {
    const store = getStore();
    const index = store.workflows.findIndex((w) => w.workflow_id === workflow.workflow_id);
    if (index === -1) store.workflows = [workflow, ...store.workflows];
    else store.workflows[index] = workflow;
    return clone(workflow);
  },

  async listSpecialists() {
    await delay(60);
    return clone(getStore().specialists);
  },

  async listRules() {
    await delay(50);
    return clone(getStore().rules);
  },

  async setRuleEnabled(ruleId, enabled) {
    await delay(60);
    const rule = getStore().rules.find((r) => r.rule_id === ruleId);
    if (!rule) throw new Error(`Rule ${ruleId} not found`);
    rule.enabled = enabled;
    return clone(rule);
  },

  async listAudit() {
    await delay(60);
    return clone(getStore().audit);
  },

  async putAudit(entry) {
    const store = getStore();
    const full: AuditEntry = { ...entry, audit_id: nextId("audit"), timestamp: new Date().toISOString() };
    store.audit = [full, ...store.audit];
    return clone(full);
  },

  async getSummary(patientId) {
    await delay(60);
    const found = getStore().summaries[patientId];
    return found ? clone(found) : null;
  },

  async putSummary(summary) {
    getStore().summaries[summary.patient_id] = summary;
    return clone(summary);
  },

  async getEHR(patientId) {
    await delay(60);
    const found = getStore().ehr[patientId];
    return found ? clone(found) : null;
  },

  async putEHR(ehr) {
    getStore().ehr[ehr.patient_id] = ehr;
    return clone(ehr);
  },
};