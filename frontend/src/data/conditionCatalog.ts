import type { Condition, LabResult, Medication } from "@/types/clinical";

export type ConditionKey =
  | "Type 2 Diabetes Mellitus"
  | "Hypertension"
  | "COPD"
  | "Chronic Kidney Disease"
  | "Hyperlipidemia";

export const CONDITION_CATALOG: Record<ConditionKey, Omit<Condition, "onsetDate" | "status">> = {
  "Type 2 Diabetes Mellitus": { name: "Type 2 Diabetes Mellitus", code: "E11.9", codeSystem: "ICD-10" },
  Hypertension: { name: "Hypertension", code: "I10", codeSystem: "ICD-10" },
  COPD: { name: "Chronic Obstructive Pulmonary Disease", code: "J44.9", codeSystem: "ICD-10" },
  "Chronic Kidney Disease": { name: "Chronic Kidney Disease, Stage 3", code: "N18.3", codeSystem: "ICD-10" },
  Hyperlipidemia: { name: "Hyperlipidemia", code: "E78.5", codeSystem: "ICD-10" },
};

export const MEDICATION_CATALOG: Record<ConditionKey, Omit<Medication, "startDate" | "status">[]> = {
  "Type 2 Diabetes Mellitus": [
    { name: "Metformin", dose: "1000 mg", frequency: "Twice daily" },
    { name: "Glimepiride", dose: "2 mg", frequency: "Once daily" },
  ],
  Hypertension: [
    { name: "Lisinopril", dose: "10 mg", frequency: "Once daily" },
    { name: "Amlodipine", dose: "5 mg", frequency: "Once daily" },
  ],
  COPD: [
    { name: "Tiotropium inhaler", dose: "18 mcg", frequency: "Once daily" },
    { name: "Salbutamol inhaler", dose: "100 mcg", frequency: "As needed" },
  ],
  "Chronic Kidney Disease": [{ name: "Sodium bicarbonate", dose: "650 mg", frequency: "Twice daily" }],
  Hyperlipidemia: [{ name: "Atorvastatin", dose: "20 mg", frequency: "Once nightly" }],
};

export interface LabSpec {
  test: string;
  unit: string;
  referenceRange: string;
  normal: number;
  high?: boolean;
}

export const LAB_REFERENCE: Record<string, { unit: string; referenceRange: string; low: number; high: number }> = {
  HbA1c: { unit: "%", referenceRange: "< 7%", low: 4, high: 7 },
  Creatinine: { unit: "mg/dL", referenceRange: "0.7 - 1.3", low: 0.7, high: 1.3 },
  eGFR: { unit: "mL/min/1.73m²", referenceRange: "> 60", low: 60, high: 200 },
  "LDL Cholesterol": { unit: "mg/dL", referenceRange: "< 100", low: 0, high: 100 },
  Triglycerides: { unit: "mg/dL", referenceRange: "< 150", low: 0, high: 150 },
  Potassium: { unit: "mmol/L", referenceRange: "3.5 - 5.1", low: 3.5, high: 5.1 },
  SpO2: { unit: "%", referenceRange: "95 - 100", low: 95, high: 100 },
  "Systolic BP": { unit: "mmHg", referenceRange: "< 130", low: 90, high: 130 },
};

export function buildLab(test: string, value: number, date: string): LabResult {
  const ref = LAB_REFERENCE[test];
  let status: LabResult["status"] = "NORMAL";
  if (ref) {
    if (value > ref.high) status = "HIGH";
    else if (value < ref.low) status = "LOW";
  }
  if (test === "HbA1c" && value >= 10) status = "CRITICAL";
  if (test === "Creatinine" && value >= 2.5) status = "CRITICAL";
  return {
    test,
    value,
    unit: ref?.unit ?? "",
    referenceRange: ref?.referenceRange ?? "-",
    status,
    date,
  };
}