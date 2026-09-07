import type { BedrockService } from "@/services/aws/interfaces";
import type { ClinicalSummary, ExtractedEHR, FlaggedIssue, Severity } from "@/types/clinical";
import { getStore } from "./store";
import { delay } from "./latency";
import { generateAiNarrative } from "@/lib/clinicalAi.functions";

const MODEL_ID = "anthropic.claude-3-5-sonnet (mock)";

function severityForLab(test: string, value: number): Severity {
  if (test === "HbA1c") return value >= 9 ? "High" : "Medium";
  if (test === "Creatinine") return value >= 1.9 ? "High" : "Medium";
  if (test === "SpO2") return value < 92 ? "High" : "Medium";
  if (test === "eGFR") return value < 45 ? "High" : "Medium";
  if (test === "Potassium") return value > 5.2 ? "High" : "Medium";
  if (test === "LDL Cholesterol") return value > 160 ? "Medium" : "Low";
  return "Low";
}

function issueTitle(test: string): string {
  switch (test) {
    case "HbA1c":
      return "Elevated HbA1c — poor glycaemic control";
    case "Creatinine":
      return "Abnormal kidney function";
    case "eGFR":
      return "Reduced estimated glomerular filtration rate";
    case "SpO2":
      return "Reduced oxygen saturation";
    case "Potassium":
      return "Electrolyte abnormality (potassium)";
    case "LDL Cholesterol":
      return "Elevated LDL cholesterol";
    case "Triglycerides":
      return "Elevated triglycerides";
    case "Systolic BP":
      return "Uncontrolled systolic blood pressure";
    default:
      return `Abnormal ${test}`;
  }
}

function detectMedicationConflicts(ehr: ExtractedEHR): string[] {
  const names = ehr.medications.map((m) => m.name.toLowerCase());
  const conflicts: string[] = [];
  const creatinine = ehr.labs.find((l) => l.test === "Creatinine");
  if (names.includes("metformin") && creatinine && creatinine.value > 1.5) {
    conflicts.push(
      "Metformin is currently active while creatinine is elevated — renal dosing review is indicated.",
    );
  }
  const potassium = ehr.labs.find((l) => l.test === "Potassium");
  if (names.includes("lisinopril") && potassium && potassium.value > 5.1) {
    conflicts.push("ACE inhibitor (lisinopril) active with hyperkalaemia — monitor potassium closely.");
  }
  if (names.includes("glimepiride") && names.includes("metformin")) {
    conflicts.push("Dual oral hypoglycaemic therapy — hypoglycaemia risk should be reviewed.");
  }
  return conflicts;
}

/**
 * mockBedrockService() — replace with bedrockService() invoking an Amazon
 * Bedrock model through the Patient Summary Agent.
 */
export const mockBedrockService: BedrockService = {
  async generateClinicalSummary(ehr) {
    await delay(320);
    const abnormal = ehr.labs.filter((l) => l.status !== "NORMAL");
    const rules = getStore().rules.filter((r) => r.enabled);

    const issues: FlaggedIssue[] = abnormal.map((lab, i) => {
      const rule = rules.find((r) => {
        const e = r.expression;
        if (e.test !== lab.test) return false;
        if (e.type === "condition-lab") {
          const hasCondition = ehr.conditions.some((c) =>
            c.name.toLowerCase().includes((e.condition ?? "").toLowerCase()),
          );
          if (!hasCondition) return false;
        }
        if (e.operator === ">") return lab.value > (e.threshold ?? 0);
        if (e.operator === ">=") return lab.value >= (e.threshold ?? 0);
        if (e.operator === "<") return lab.value < (e.threshold ?? 0);
        return false;
      });

      return {
        issue_id: `ISS-${ehr.patient_id.replace("PAT-", "")}-${i + 1}`,
        patient_id: ehr.patient_id,
        severity: rule?.priority ?? severityForLab(lab.test, lab.value),
        issue: issueTitle(lab.test),
        evidence: `${lab.test}: ${lab.value}${lab.unit} (ref ${lab.referenceRange})`,
        source: `Laboratory result · ${lab.date}`,
        detected_by: "Patient Summary Agent",
        rule_id: rule?.rule_id ?? null,
        rule_expression: rule?.trigger ?? null,
        recommended_specialist: rule?.specialist ?? "Other",
        referral_status: "Not Referred",
      };
    });

    const conditionNames = ehr.conditions.map((c) => c.name).join(" and ");
    const medNames = ehr.medications
      .filter((m) => m.status === "Active")
      .map((m) => m.name.toLowerCase())
      .join(", ");
    const abnormalText = abnormal
      .map((l) => `${l.test} at ${l.value}${l.unit}`)
      .join(", ");
    const conflicts = detectMedicationConflicts(ehr);

    const summaryText =
      `Patient has a documented history of ${conditionNames || "no active chronic conditions"}. ` +
      (abnormal.length
        ? `Recent laboratory results demonstrate ${abnormalText}. `
        : "Recent laboratory results are within reference ranges. ") +
      (medNames ? `Current medications include ${medNames}. ` : "No active medications recorded. ") +
      (issues.length
        ? "Findings indicate the need for specialist review based on configured referral rules."
        : "No referral rule thresholds were met at this time.");

    const lastEncounter = ehr.encounters[0];

    const summary: ClinicalSummary = {
      patient_id: ehr.patient_id,
      summary: summaryText,
      sections: [
        {
          heading: "Patient Overview",
          body: `${ehr.demographics.name}, ${ehr.demographics.age}-year-old ${ehr.demographics.gender.toLowerCase()} (DOB ${ehr.demographics.dateOfBirth}), record ${ehr.patient_id}.`,
        },
        {
          heading: "Active Conditions",
          body:
            ehr.conditions.map((c) => `${c.name} (${c.code}, onset ${c.onsetDate})`).join("; ") ||
            "None documented.",
        },
        {
          heading: "Current Medications",
          body:
            ehr.medications
              .filter((m) => m.status === "Active")
              .map((m) => `${m.name} ${m.dose} ${m.frequency.toLowerCase()}`)
              .join("; ") || "None documented.",
        },
        {
          heading: "Recent Encounters",
          body: lastEncounter
            ? `Most recent encounter ${lastEncounter.date} — ${lastEncounter.type} with ${lastEncounter.provider} for ${lastEncounter.reason.toLowerCase()}.`
            : "No encounters documented.",
        },
        {
          heading: "Recent Laboratory Results",
          body:
            abnormal.length > 0
              ? abnormal
                  .map((l) => `${l.test} ${l.value}${l.unit} (${l.status}, ref ${l.referenceRange})`)
                  .join("; ")
              : "All reported results within reference range.",
        },
        {
          heading: "Clinical Concerns",
          body: issues.length
            ? issues.map((i) => `${i.severity} priority — ${i.issue} (${i.evidence}).`).join(" ")
            : "No threshold-based concerns identified.",
        },
        {
          heading: "Recommended Referral Actions",
          body: issues.length
            ? Array.from(new Set(issues.map((i) => i.recommended_specialist)))
                .map((s) => `Specialist review by ${s}.`)
                .join(" ")
            : "No referral action recommended at this time.",
        },
      ],
      concerns: issues.map((i) => `${i.issue} — ${i.evidence}`),
      abnormal_labs: abnormal,
      medication_conflicts: conflicts,
      recommended_actions: Array.from(new Set(issues.map((i) => i.recommended_specialist))).map(
        (s) => `Create ${s} referral`,
      ),
      issues,
      generated_at: new Date().toISOString(),
      model: MODEL_ID,
    };

    // Real AI narrative via Lovable AI. Rule-derived issues stay deterministic;
    // only the human-readable narrative is model-generated. Falls back silently.
    try {
      const result = await generateAiNarrative({
        data: { ehr: JSON.stringify(ehr), rules: JSON.stringify(rules) },
      });
      if ("narrative" in result) {
        const n = result.narrative;
        if (n.summary) summary.summary = n.summary;
        if (n.sections.length) summary.sections = n.sections;
        if (n.concerns.length) summary.concerns = n.concerns;
        if (n.medication_conflicts.length) summary.medication_conflicts = n.medication_conflicts;
        if (n.recommended_actions.length) summary.recommended_actions = n.recommended_actions;
        summary.model = result.model;
      } else {
        summary.model = `${MODEL_ID} — ${result.error}`;
      }
    } catch {
      // keep deterministic summary
    }

    return summary;
  },
};