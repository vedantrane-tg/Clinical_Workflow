import type { ReferralRule } from "@/types/clinical";

/**
 * Referral rules are stored as plain JSON so they can later be served by a
 * configuration service (DynamoDB / AppConfig) without changing consumers.
 */
export const REFERRAL_RULES: ReferralRule[] = [
  {
    rule_id: "RULE-001",
    condition: "Type 2 Diabetes Mellitus",
    trigger: "HbA1c > 9.0%",
    expression: { type: "lab", test: "HbA1c", operator: ">", threshold: 9.0 },
    specialist: "Endocrinologist",
    priority: "High",
    enabled: true,
  },
  {
    rule_id: "RULE-002",
    condition: "Chronic Kidney Disease / Renal impairment",
    trigger: "Creatinine > 1.5 mg/dL",
    expression: { type: "lab", test: "Creatinine", operator: ">", threshold: 1.5 },
    specialist: "Nephrologist",
    priority: "High",
    enabled: true,
  },
  {
    rule_id: "RULE-003",
    condition: "COPD",
    trigger: "COPD with SpO2 < 92%",
    expression: { type: "condition-lab", condition: "COPD", test: "SpO2", operator: "<", threshold: 92 },
    specialist: "Pulmonologist",
    priority: "High",
    enabled: true,
  },
  {
    rule_id: "RULE-004",
    condition: "Hypertension",
    trigger: "Hypertension with LDL Cholesterol > 160 mg/dL",
    expression: {
      type: "condition-lab",
      condition: "Hypertension",
      test: "LDL Cholesterol",
      operator: ">",
      threshold: 160,
    },
    specialist: "Cardiologist",
    priority: "Medium",
    enabled: true,
  },
  {
    rule_id: "RULE-005",
    condition: "Hyperlipidemia",
    trigger: "Triglycerides > 400 mg/dL",
    expression: { type: "lab", test: "Triglycerides", operator: ">", threshold: 400 },
    specialist: "Other",
    priority: "Low",
    enabled: false,
  },
];