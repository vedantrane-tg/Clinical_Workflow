import type { Condition, Encounter, LabResult, Medication, Patient, Severity } from "@/types/clinical";
import { CONDITION_CATALOG, MEDICATION_CATALOG, buildLab, type ConditionKey } from "./conditionCatalog";

interface Seed {
  id: string;
  name: string;
  gender: Patient["gender"];
  dob: string;
  conditions: ConditionKey[];
  labs: Record<string, number>;
  lastEncounter: string;
  risk: Severity;
}

const SEEDS: Seed[] = [
  {
    id: "PAT-1001",
    name: "Aarav Sharma",
    gender: "Male",
    dob: "1968-04-12",
    conditions: ["Type 2 Diabetes Mellitus", "Hypertension"],
    labs: { HbA1c: 10.2, Creatinine: 2.1, eGFR: 42, "LDL Cholesterol": 148, Potassium: 4.6, "Systolic BP": 152 },
    lastEncounter: "2026-07-28",
    risk: "High",
  },
  {
    id: "PAT-1002",
    name: "Priya Patel",
    gender: "Female",
    dob: "1975-09-03",
    conditions: ["Type 2 Diabetes Mellitus", "Hyperlipidemia"],
    labs: { HbA1c: 8.1, Creatinine: 1.0, "LDL Cholesterol": 172, Triglycerides: 320, "Systolic BP": 128 },
    lastEncounter: "2026-07-19",
    risk: "Medium",
  },
  {
    id: "PAT-1003",
    name: "Rahul Deshmukh",
    gender: "Male",
    dob: "1959-01-22",
    conditions: ["COPD", "Hypertension"],
    labs: { SpO2: 89, "Systolic BP": 146, Creatinine: 1.2, "LDL Cholesterol": 118 },
    lastEncounter: "2026-08-01",
    risk: "High",
  },
  {
    id: "PAT-1004",
    name: "Ananya Joshi",
    gender: "Female",
    dob: "1982-11-30",
    conditions: ["Hypertension"],
    labs: { "Systolic BP": 134, Creatinine: 0.9, "LDL Cholesterol": 96, HbA1c: 5.6 },
    lastEncounter: "2026-06-12",
    risk: "Low",
  },
  {
    id: "PAT-1005",
    name: "Rohan Kulkarni",
    gender: "Male",
    dob: "1964-06-08",
    conditions: ["Chronic Kidney Disease", "Hypertension"],
    labs: { Creatinine: 2.6, eGFR: 33, Potassium: 5.4, "Systolic BP": 149 },
    lastEncounter: "2026-07-30",
    risk: "High",
  },
  {
    id: "PAT-1006",
    name: "Ishita Menon",
    gender: "Female",
    dob: "1971-02-17",
    conditions: ["Type 2 Diabetes Mellitus", "Chronic Kidney Disease"],
    labs: { HbA1c: 9.4, Creatinine: 1.9, eGFR: 46, Potassium: 4.9 },
    lastEncounter: "2026-07-25",
    risk: "High",
  },
  {
    id: "PAT-1007",
    name: "Vivaan Reddy",
    gender: "Male",
    dob: "1988-05-05",
    conditions: ["Hyperlipidemia"],
    labs: { "LDL Cholesterol": 142, Triglycerides: 210, HbA1c: 5.9 },
    lastEncounter: "2026-05-20",
    risk: "Low",
  },
  {
    id: "PAT-1008",
    name: "Kavya Nair",
    gender: "Female",
    dob: "1955-12-11",
    conditions: ["COPD"],
    labs: { SpO2: 93, "Systolic BP": 124, Creatinine: 1.1 },
    lastEncounter: "2026-07-02",
    risk: "Medium",
  },
  {
    id: "PAT-1009",
    name: "Aditya Chauhan",
    gender: "Male",
    dob: "1979-08-21",
    conditions: ["Type 2 Diabetes Mellitus", "Hypertension", "Hyperlipidemia"],
    labs: { HbA1c: 11.1, Creatinine: 1.4, "LDL Cholesterol": 188, "Systolic BP": 158 },
    lastEncounter: "2026-08-03",
    risk: "High",
  },
  {
    id: "PAT-1010",
    name: "Meera Krishnan",
    gender: "Female",
    dob: "1990-03-14",
    conditions: ["Hypertension"],
    labs: { "Systolic BP": 131, Creatinine: 0.8, HbA1c: 5.4 },
    lastEncounter: "2026-04-27",
    risk: "Low",
  },
  {
    id: "PAT-1011",
    name: "Siddharth Rao",
    gender: "Male",
    dob: "1962-10-02",
    conditions: ["Chronic Kidney Disease", "Type 2 Diabetes Mellitus"],
    labs: { Creatinine: 3.1, eGFR: 26, HbA1c: 8.8, Potassium: 5.6 },
    lastEncounter: "2026-07-31",
    risk: "High",
  },
  {
    id: "PAT-1012",
    name: "Nisha Agarwal",
    gender: "Female",
    dob: "1984-07-19",
    conditions: ["Type 2 Diabetes Mellitus"],
    labs: { HbA1c: 7.4, Creatinine: 0.9, "LDL Cholesterol": 104 },
    lastEncounter: "2026-06-30",
    risk: "Medium",
  },
  {
    id: "PAT-1013",
    name: "Manav Gupta",
    gender: "Male",
    dob: "1957-04-09",
    conditions: ["COPD", "Hyperlipidemia"],
    labs: { SpO2: 88, Triglycerides: 430, "LDL Cholesterol": 156 },
    lastEncounter: "2026-07-22",
    risk: "High",
  },
  {
    id: "PAT-1014",
    name: "Tara Bhatt",
    gender: "Female",
    dob: "1993-01-28",
    conditions: ["Hyperlipidemia"],
    labs: { "LDL Cholesterol": 128, Triglycerides: 168 },
    lastEncounter: "2026-03-15",
    risk: "Low",
  },
  {
    id: "PAT-1015",
    name: "Devansh Malhotra",
    gender: "Male",
    dob: "1970-11-06",
    conditions: ["Hypertension", "Hyperlipidemia"],
    labs: { "Systolic BP": 154, "LDL Cholesterol": 176, Creatinine: 1.2 },
    lastEncounter: "2026-07-11",
    risk: "Medium",
  },
  {
    id: "PAT-1016",
    name: "Sanya Kapoor",
    gender: "Female",
    dob: "1966-09-23",
    conditions: ["Type 2 Diabetes Mellitus", "Hypertension"],
    labs: { HbA1c: 9.8, "Systolic BP": 142, Creatinine: 1.3 },
    lastEncounter: "2026-07-27",
    risk: "High",
  },
  {
    id: "PAT-1017",
    name: "Yash Thakur",
    gender: "Male",
    dob: "1986-02-02",
    conditions: ["Hypertension"],
    labs: { "Systolic BP": 138, Creatinine: 1.0 },
    lastEncounter: "2026-05-08",
    risk: "Low",
  },
  {
    id: "PAT-1018",
    name: "Ritika Sen",
    gender: "Female",
    dob: "1974-06-17",
    conditions: ["Chronic Kidney Disease"],
    labs: { Creatinine: 1.8, eGFR: 48, Potassium: 4.8 },
    lastEncounter: "2026-07-14",
    risk: "Medium",
  },
  {
    id: "PAT-1019",
    name: "Kabir Anand",
    gender: "Male",
    dob: "1961-12-29",
    conditions: ["COPD", "Hypertension"],
    labs: { SpO2: 91, "Systolic BP": 147, "LDL Cholesterol": 132 },
    lastEncounter: "2026-08-02",
    risk: "High",
  },
  {
    id: "PAT-1020",
    name: "Aisha Khan",
    gender: "Female",
    dob: "1980-08-08",
    conditions: ["Type 2 Diabetes Mellitus", "Hyperlipidemia"],
    labs: { HbA1c: 8.6, "LDL Cholesterol": 164, Triglycerides: 288 },
    lastEncounter: "2026-07-09",
    risk: "Medium",
  },
  {
    id: "PAT-1021",
    name: "Neel Bhagat",
    gender: "Male",
    dob: "1996-05-12",
    conditions: ["Hyperlipidemia"],
    labs: { "LDL Cholesterol": 112, Triglycerides: 142 },
    lastEncounter: "2026-02-19",
    risk: "Low",
  },
  {
    id: "PAT-1022",
    name: "Lakshmi Iyer",
    gender: "Female",
    dob: "1953-03-30",
    conditions: ["Chronic Kidney Disease", "Hypertension"],
    labs: { Creatinine: 2.3, eGFR: 35, "Systolic BP": 151, Potassium: 5.2 },
    lastEncounter: "2026-07-29",
    risk: "High",
  },
  {
    id: "PAT-1023",
    name: "Arnav Pillai",
    gender: "Male",
    dob: "1977-10-25",
    conditions: ["Type 2 Diabetes Mellitus"],
    labs: { HbA1c: 6.8, Creatinine: 1.0 },
    lastEncounter: "2026-06-05",
    risk: "Low",
  },
  {
    id: "PAT-1024",
    name: "Divya Rane",
    gender: "Female",
    dob: "1969-07-07",
    conditions: ["Type 2 Diabetes Mellitus", "Chronic Kidney Disease", "Hypertension"],
    labs: { HbA1c: 9.1, Creatinine: 2.0, eGFR: 40, "Systolic BP": 145 },
    lastEncounter: "2026-08-04",
    risk: "High",
  },
  {
    id: "PAT-1025",
    name: "Harsh Vardhan",
    gender: "Male",
    dob: "1948-11-19",
    conditions: ["COPD", "Chronic Kidney Disease"],
    labs: { SpO2: 90, Creatinine: 1.7, eGFR: 51 },
    lastEncounter: "2026-07-18",
    risk: "High",
  },
  {
    id: "PAT-1026",
    name: "Pooja Salunke",
    gender: "Female",
    dob: "1991-09-16",
    conditions: ["Hypertension"],
    labs: { "Systolic BP": 126, Creatinine: 0.8 },
    lastEncounter: "2026-01-24",
    risk: "Low",
  },
];

const ENCOUNTER_TYPES = [
  { type: "Outpatient Visit", reason: "Routine chronic disease follow-up" },
  { type: "Laboratory Visit", reason: "Scheduled laboratory panel" },
  { type: "Telehealth Consult", reason: "Medication review" },
  { type: "Emergency Visit", reason: "Acute symptom evaluation" },
];

const PROVIDERS = [
  "Dr. S. Deshpande (Internal Medicine)",
  "Dr. R. Fernandes (Family Medicine)",
  "Dr. A. Bose (Internal Medicine)",
];

function ageFrom(dob: string): number {
  const birth = new Date(dob);
  const now = new Date("2026-08-10");
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildPatient(seed: Seed, index: number): Patient {
  const conditions: Condition[] = seed.conditions.map((key, i) => ({
    ...CONDITION_CATALOG[key],
    status: "Active",
    onsetDate: shiftDate(seed.lastEncounter, 400 + i * 260 + index * 7),
  }));

  const medications: Medication[] = seed.conditions.flatMap((key, i) =>
    MEDICATION_CATALOG[key].map((m, j) => ({
      ...m,
      status: "Active" as const,
      startDate: shiftDate(seed.lastEncounter, 300 + i * 90 + j * 40),
    })),
  );

  const encounters: Encounter[] = [0, 1, 2].map((i) => {
    const et = ENCOUNTER_TYPES[(index + i) % ENCOUNTER_TYPES.length]!;
    return {
      date: shiftDate(seed.lastEncounter, i * 45),
      type: et.type,
      provider: PROVIDERS[(index + i) % PROVIDERS.length]!,
      reason: et.reason,
    };
  });

  const labs: LabResult[] = Object.entries(seed.labs).map(([test, value]) =>
    buildLab(test, value, seed.lastEncounter),
  );

  return {
    patient_id: seed.id,
    name: seed.name,
    date_of_birth: seed.dob,
    gender: seed.gender,
    age: ageFrom(seed.dob),
    risk: seed.risk,
    conditions,
    medications,
    encounters,
    labs,
    workflow_status: "Not Started",
    last_encounter: seed.lastEncounter,
    issues_count: 0,
    referrals_count: 0,
  };
}

export const SYNTHETIC_PATIENTS: Patient[] = SEEDS.map(buildPatient);