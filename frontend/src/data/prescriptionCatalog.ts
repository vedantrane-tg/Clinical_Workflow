export const DRUG_FORMS = [
  "Tab",
  "Cap",
  "Syp",
  "Inj",
  "Cream",
  "Gel",
  "Lotion",
  "Shampoo",
  "Facewash",
  "Ointment",
  "Drops",
  "Other",
] as const;

export type DrugForm = (typeof DRUG_FORMS)[number];

export const DRUG_OPTIONS: { form: DrugForm; name: string; strengths: string[] }[] = [
  { form: "Tab", name: "Dutanes", strengths: ["0.5 mg", "1 mg"] },
  { form: "Tab", name: "Metformin", strengths: ["500 mg", "850 mg", "1000 mg"] },
  { form: "Tab", name: "Amlodipine", strengths: ["2.5 mg", "5 mg", "10 mg"] },
  { form: "Tab", name: "Atorvastatin", strengths: ["10 mg", "20 mg", "40 mg"] },
  { form: "Tab", name: "Telmisartan", strengths: ["20 mg", "40 mg", "80 mg"] },
  { form: "Tab", name: "Pantoprazole", strengths: ["20 mg", "40 mg"] },
  { form: "Tab", name: "Cetirizine", strengths: ["5 mg", "10 mg"] },
  { form: "Tab", name: "Paracetamol", strengths: ["500 mg", "650 mg"] },
  { form: "Cap", name: "Omeprazole", strengths: ["20 mg", "40 mg"] },
  { form: "Cap", name: "Amoxicillin", strengths: ["250 mg", "500 mg"] },
  { form: "Syp", name: "Amoxicillin", strengths: ["125 mg/5 ml", "250 mg/5 ml"] },
  { form: "Shampoo", name: "CAPIFINE", strengths: ["—"] },
  { form: "Lotion", name: "KETOCARE", strengths: ["—"] },
  { form: "Facewash", name: "DERMA CLEAR", strengths: ["—"] },
  { form: "Gel", name: "CLINDAC A", strengths: ["1%"] },
  { form: "Cream", name: "Mometasone", strengths: ["0.1%"] },
  { form: "Cream", name: "Clotrimazole", strengths: ["1%"] },
  { form: "Gel", name: "Diclofenac", strengths: ["1%"] },
  { form: "Drops", name: "Ciplox", strengths: ["0.3%"] },
];

export const DOSE_COUNTS = [0, 1, 2, 3] as const;

export const DURATION_UNITS = ["day(s)", "week(s)", "month(s)"] as const;

export const TIMING_OPTIONS = [
  "After Food",
  "Before Food",
  "With Food",
  "Empty Stomach",
  "Apply topically",
  "ALTERNATE DAYS",
  "Once daily at night after dinner",
  "Wash face 2 to 3 times a day",
  "As directed",
] as const;

export type PrescriptionRow = {
  id: string;
  drug_form: DrugForm;
  drug_name: string;
  strength: string;
  morning: number;
  afternoon: number;
  night: number;
  duration_value: number;
  duration_unit: (typeof DURATION_UNITS)[number];
  instruction: string;
};

export function emptyPrescriptionRow(): PrescriptionRow {
  return {
    id: `rx-${crypto.randomUUID()}`,
    drug_form: "Tab",
    drug_name: "",
    strength: "",
    morning: 1,
    afternoon: 0,
    night: 0,
    duration_value: 7,
    duration_unit: "day(s)",
    instruction: "After Food",
  };
}

export function drugLabel(form: string, name: string) {
  return `${form} ${name}`.trim();
}

export function formatFrequency(row: Pick<PrescriptionRow, "morning" | "afternoon" | "night">) {
  return `${row.morning} - ${row.afternoon} - ${row.night}`;
}

export function formatInstructions(row: Pick<PrescriptionRow, "duration_value" | "duration_unit" | "instruction">) {
  const duration = `${row.duration_value} ${row.duration_unit}`;
  return row.instruction ? `${duration}\n${row.instruction}` : duration;
}

export function strengthsFor(form: string, name: string) {
  const match = DRUG_OPTIONS.find((d) => d.form === form && d.name === name);
  return match?.strengths ?? ["—"];
}

export function namesForForm(form: string) {
  return DRUG_OPTIONS.filter((d) => d.form === form).map((d) => d.name);
}

export function toPrescriptionPayload(rows: PrescriptionRow[]) {
  return rows
    .filter((r) => r.drug_name.trim())
    .map((r, index) => ({
      seq: index + 1,
      drug_form: r.drug_form,
      drug_name: r.drug_name.trim(),
      drug_label: drugLabel(r.drug_form, r.drug_name.trim()),
      strength: r.strength === "—" ? "" : r.strength,
      morning: r.morning,
      afternoon: r.afternoon,
      night: r.night,
      frequency: formatFrequency(r),
      duration_value: r.duration_value,
      duration_unit: r.duration_unit,
      instruction: r.instruction,
      instructions_text: formatInstructions(r),
    }));
}
