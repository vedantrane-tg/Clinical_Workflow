import type { HealthLakeService } from "@/services/aws/interfaces";
import type { ExtractedEHR } from "@/types/clinical";
import { clone, getStore } from "./store";
import { delay } from "./latency";

/**
 * mockHealthLakeService() — replace with healthLakeService() backed by
 * AWS HealthLake FHIR R4 search + read operations.
 */
export const mockHealthLakeService: HealthLakeService = {
  async listPatients() {
    await delay(120);
    return clone(getStore().patients);
  },

  async getPatient(patientId) {
    await delay(80);
    const found = getStore().patients.find((p) => p.patient_id === patientId);
    return found ? clone(found) : null;
  },

  async extractEHR(patientId) {
    await delay(250);
    const patient = getStore().patients.find((p) => p.patient_id === patientId);
    if (!patient) {
      throw new Error(`HealthLake: no FHIR Patient resource found for ${patientId}`);
    }
    const ehr: ExtractedEHR = {
      patient_id: patient.patient_id,
      demographics: {
        patientId: patient.patient_id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        dateOfBirth: patient.date_of_birth,
      },
      conditions: clone(patient.conditions),
      medications: clone(patient.medications),
      encounters: clone(patient.encounters),
      labs: clone(patient.labs),
      extracted_at: new Date().toISOString(),
      source: "AWS HealthLake (mock) · FHIR R4",
    };
    return ehr;
  },
};