import type { BedrockService, DynamoDBService, HealthLakeService, NotificationService } from "@/services/aws/interfaces";
import type { ClinicalSummary, ExtractedEHR, Referral, Role, Specialist } from "@/types/clinical";
import { nextId } from "@/services/mock/store";

export interface AgentContext {
  healthLake: HealthLakeService;
  bedrock: BedrockService;
  db: DynamoDBService;
  sns: NotificationService;
  actor: { name: string; role: Role };
}

/**
 * Agent 1 — EHR Extractor Agent.
 * Responsibility: query HealthLake/FHIR and structure the data. Nothing else.
 */
export async function ehrExtractorAgent(ctx: AgentContext, patientId: string): Promise<ExtractedEHR> {
  const ehr = await ctx.healthLake.extractEHR(patientId);
  await ctx.db.putEHR(ehr);
  await ctx.db.putAudit({
    user: ctx.actor.name,
    role: ctx.actor.role,
    action: "EHR Extractor Agent retrieved FHIR data",
    patient_id: patientId,
    agent: "EHR Extractor Agent",
    result: "Success",
  });
  return ehr;
}

/**
 * Agent 2 — Patient Summary Agent.
 * Responsibility: consume structured EHR, produce summary + flagged issues. No referrals.
 */
export async function patientSummaryAgent(ctx: AgentContext, ehr: ExtractedEHR): Promise<ClinicalSummary> {
  const summary = await ctx.bedrock.generateClinicalSummary(ehr);
  await ctx.db.putSummary(summary);
  await ctx.db.putAudit({
    user: ctx.actor.name,
    role: ctx.actor.role,
    action: `Patient Summary Agent generated summary (${summary.issues.length} issue(s) flagged)`,
    patient_id: ehr.patient_id,
    agent: "Patient Summary Agent",
    result: "Success",
  });
  return summary;
}

function selectSpecialist(specialists: Specialist[], type: Referral["specialist_type"]): Specialist | null {
  const candidates = specialists
    .filter((s) => s.specialty === type && s.availability !== "Unavailable")
    .sort((a, b) => a.active_referrals - b.active_referrals);
  return candidates[0] ?? null;
}

/**
 * Agent 3 — Referral Orchestrator Agent.
 * Responsibility: apply referral rules to flagged issues, select specialist,
 * persist referral, publish notification. It does not re-interpret clinical data.
 */
export async function referralOrchestratorAgent(
  ctx: AgentContext,
  summary: ClinicalSummary,
  patientName: string,
): Promise<{ referrals: Referral[]; skipped: string[] }> {
  const specialists = await ctx.db.listSpecialists();
  const referrals: Referral[] = [];
  const skipped: string[] = [];

  const actionable = summary.issues.filter((i) => i.rule_id !== null);
  const byType = new Map<Referral["specialist_type"], typeof actionable>();
  for (const issue of actionable) {
    const list = byType.get(issue.recommended_specialist) ?? [];
    list.push(issue);
    byType.set(issue.recommended_specialist, list);
  }

  for (const [type, issues] of byType) {
    const specialist = selectSpecialist(specialists, type);
    const primary = issues[0]!;
    if (!specialist) {
      skipped.push(`No available ${type} — referral could not be assigned.`);
      issues.forEach((i) => (i.referral_status = "Pending"));
      await ctx.db.putAudit({
        user: "agent",
        role: ctx.actor.role,
        action: `Referral Orchestrator could not assign a ${type}: no available specialist`,
        patient_id: summary.patient_id,
        agent: "Referral Orchestrator Agent",
        result: "Failed",
      });
      continue;
    }

    const referral: Referral = {
      referral_id: nextId("referral"),
      patient_id: summary.patient_id,
      patient_name: patientName,
      issue: issues.map((i) => i.issue).join(" • "),
      specialist_type: type,
      specialist_id: specialist.specialist_id,
      specialist_name: specialist.name,
      priority: primary.severity,
      status: "Created",
      created_at: new Date().toISOString(),
      agent_notes: `Auto-created by Referral Orchestrator Agent. Triggered by ${issues
        .map((i) => `${i.rule_id} (${i.rule_expression})`)
        .join(", ")}. Evidence: ${issues.map((i) => i.evidence).join("; ")}.`,
      created_by: "Referral Orchestrator Agent",
    };

    await ctx.db.putReferral(referral);
    await ctx.sns.publishReferralNotification(referral);
    issues.forEach((i) => (i.referral_status = "Created"));
    referrals.push(referral);

    await ctx.db.putAudit({
      user: "agent",
      role: ctx.actor.role,
      action: `Referral Orchestrator created ${type} referral ${referral.referral_id} (SNS notification published)`,
      patient_id: summary.patient_id,
      agent: "Referral Orchestrator Agent",
      result: "Success",
    });
  }

  await ctx.db.putSummary(summary);
  return { referrals, skipped };
}