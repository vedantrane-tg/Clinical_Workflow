import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Info,
  Pencil,
  Plus,
  Stethoscope,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { QueryError } from "@/components/common/QueryError";
import { SeverityBadge, WorkflowStatusBadge, Pill } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  patientHistoryQuery,
  useDeletePatient,
  usePatients,
  useUpdatePatient,
} from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";
import type { Patient } from "@/types/clinical";

export const Route = createFileRoute("/patients/")({
  head: () => ({
    meta: [
      { title: "Patients — ClinicalFlow AI" },
      {
        name: "description",
        content:
          "Synthetic patient roster with risk level, workflow status, flagged issues and referral counts for clinical triage.",
      },
      { property: "og:title", content: "Patients — ClinicalFlow AI" },
      {
        property: "og:description",
        content: "Search, filter and open synthetic patient records to run the agentic clinical workflow.",
      },
    ],
  }),
  component: PatientsPage,
});

const PAGE_SIZE = 10;

// ─── Edit Patient Dialog ─────────────────────────────────────────────────────

function EditPatientDialog({
  patient,
  open,
  onClose,
}: {
  patient: Patient | null;
  open: boolean;
  onClose: () => void;
}) {
  const updatePatient = useUpdatePatient(patient?.patient_id ?? "");
  const deletePatient = useDeletePatient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    contact_phone: "",
    contact_email: "",
    address: "",
    pincode: "",
    guardian_name: "",
    guardian_relationship: "",
    guardian_phone: "",
    guardian_email: "",
  });

  // Sync form when patient changes
  useMemo(() => {
    if (patient) {
      setForm({
        first_name: patient.first_name ?? patient.name.split(" ")[0] ?? "",
        middle_name: patient.middle_name ?? "",
        last_name: patient.last_name ?? patient.name.split(" ").slice(-1)[0] ?? "",
        contact_phone: patient.contact_phone ?? "",
        contact_email: patient.contact_email ?? "",
        address: patient.address ?? "",
        pincode: patient.pincode ?? "",
        guardian_name: patient.guardian_name ?? "",
        guardian_relationship: patient.guardian_relationship ?? "",
        guardian_phone: patient.guardian_phone ?? "",
        guardian_email: patient.guardian_email ?? "",
      });
    }
  }, [patient]);

  const { user } = useSession();

  async function handleSave() {
    if (!patient) return;
    try {
      await updatePatient.mutateAsync({
        ...(form.first_name.trim() ? { first_name: form.first_name.trim() } : {}),
        middle_name: form.middle_name.trim() || null,
        ...(form.last_name.trim() ? { last_name: form.last_name.trim() } : {}),
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        address: form.address.trim() || null,
        pincode: form.pincode.trim() || null,
        guardian_name: form.guardian_name.trim() || null,
        guardian_relationship: form.guardian_relationship.trim() || null,
        guardian_phone: form.guardian_phone.trim() || null,
        guardian_email: form.guardian_email.trim() || null,
        actor_name: user?.name ?? "Admin",
        actor_role: user?.role ?? "Admin",
      });
      toast.success("Patient info updated");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update patient");
    }
  }

  async function handleDelete() {
    if (!patient) return;
    try {
      await deletePatient.mutateAsync(patient.patient_id);
      toast.success(`Patient ${patient.name} permanently deleted`);
      setConfirmDelete(false);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete patient");
    }
  }

  if (!patient) return null;

  return (
    <>
      <Dialog open={open && !confirmDelete} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient — {patient.name}</DialogTitle>
            <DialogDescription>
              ID: <span className="font-mono text-xs">{patient.patient_id}</span> · {patient.age} yrs ·{" "}
              {patient.gender}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Name
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ep-first">First name</Label>
                <Input
                  id="ep-first"
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-middle">Middle name</Label>
                <Input
                  id="ep-middle"
                  value={form.middle_name}
                  onChange={(e) => setForm((f) => ({ ...f, middle_name: e.target.value }))}
                  placeholder="(optional)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-last">Last name</Label>
                <Input
                  id="ep-last"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </div>
            </div>

            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mt-2">
              Contact
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ep-phone">Phone</Label>
                <Input
                  id="ep-phone"
                  value={form.contact_phone}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-email">Email</Label>
                <Input
                  id="ep-email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="ep-address">Address</Label>
                <Input
                  id="ep-address"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-pincode">Pincode</Label>
                <Input
                  id="ep-pincode"
                  value={form.pincode}
                  onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                />
              </div>
            </div>

            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mt-2">
              Guardian
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ep-gname">Name</Label>
                <Input
                  id="ep-gname"
                  value={form.guardian_name}
                  onChange={(e) => setForm((f) => ({ ...f, guardian_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-grel">Relationship</Label>
                <Input
                  id="ep-grel"
                  value={form.guardian_relationship}
                  onChange={(e) => setForm((f) => ({ ...f, guardian_relationship: e.target.value }))}
                  placeholder="e.g. Spouse, Parent"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-gphone">Phone</Label>
                <Input
                  id="ep-gphone"
                  value={form.guardian_phone}
                  onChange={(e) => setForm((f) => ({ ...f, guardian_phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-gemail">Email</Label>
                <Input
                  id="ep-gemail"
                  type="email"
                  value={form.guardian_email}
                  onChange={(e) => setForm((f) => ({ ...f, guardian_email: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete patient
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" disabled={updatePatient.isPending} onClick={() => void handleSave()}>
                {updatePatient.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nested delete confirmation */}
      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Permanently delete patient</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-foreground">{patient.name}</span> (
              {patient.patient_id})? All associated records will be lost. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletePatient.isPending}
              onClick={() => void handleDelete()}
            >
              {deletePatient.isPending ? "Deleting…" : "Yes, delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Patient History Dialog ───────────────────────────────────────────────────

function PatientHistoryDialog({
  patient,
  open,
  onClose,
}: {
  patient: Patient | null;
  open: boolean;
  onClose: () => void;
}) {
  const historyQ = useQuery(patientHistoryQuery(patient?.patient_id ?? ""));
  const [tab, setTab] = useState<"audit" | "appointments" | "encounters" | "summary">("appointments");

  if (!patient) return null;

  const auditLogs = historyQ.data?.audit_logs ?? [];
  const appointments = historyQ.data?.appointments ?? [];
  const encounters = historyQ.data?.encounters ?? [];

  const tabs = [
    { id: "appointments" as const, label: "Appointments", icon: CalendarClock, count: appointments.length },
    { id: "encounters" as const, label: "Consultations", icon: Stethoscope, count: encounters.length },
    { id: "summary" as const, label: "Medical Summary", icon: FileText, count: null },
    { id: "audit" as const, label: "Activity Log", icon: ClipboardList, count: auditLogs.length },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="size-5 text-primary" />
            Patient History — {patient.name}
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{patient.patient_id}</span> · {patient.age} yrs ·{" "}
            {patient.gender} ·{" "}
            <span
              className={`font-medium ${patient.risk === "High" ? "text-destructive" : patient.risk === "Medium" ? "text-amber-600" : "text-emerald-600"}`}
            >
              {patient.risk} Risk
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-1 border-b pb-0 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="size-3.5" />
              {t.label}
              {t.count !== null && (
                <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {historyQ.isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="p-1">
              {/* Appointments */}
              {tab === "appointments" && (
                <div className="space-y-2 p-3">
                  {appointments.length === 0 ? (
                    <EmptyState
                      icon={CalendarClock}
                      title="No appointments"
                      description="This patient has no scheduled or completed appointments."
                    />
                  ) : (
                    appointments.map((a) => (
                      <div
                        key={a.appointment_id}
                        className="rounded-lg border bg-card p-3 flex items-start justify-between gap-4"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {a.visit_type}{" "}
                            <span className="text-muted-foreground font-normal">with {a.doctor_name}</span>
                          </p>
                          {a.reason && (
                            <p className="text-xs text-muted-foreground mt-0.5">{a.reason}</p>
                          )}
                          {a.notes && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">"{a.notes}"</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono text-muted-foreground">
                            {a.starts_at ? new Date(a.starts_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">{a.duration_minutes} min</p>
                          <Badge
                            variant="outline"
                            className={`mt-1 text-[10px] ${
                              a.status === "Completed"
                                ? "border-emerald-500 text-emerald-600"
                                : a.status === "Cancelled" || a.status === "No Show"
                                  ? "border-destructive text-destructive"
                                  : "border-amber-500 text-amber-600"
                            }`}
                          >
                            {a.status}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Encounters / Consultations */}
              {tab === "encounters" && (
                <div className="space-y-3 p-3">
                  {encounters.length === 0 ? (
                    <EmptyState
                      icon={Stethoscope}
                      title="No consultations"
                      description="No consultation records found for this patient."
                    />
                  ) : (
                    encounters.map((e) => (
                      <EncounterCard key={e.encounter_id} encounter={e} />
                    ))
                  )}
                </div>
              )}

              {/* Medical Summary */}
              {tab === "summary" && (
                <div className="space-y-4 p-3">
                  {/* Conditions */}
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                      Conditions
                    </p>
                    {patient.conditions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No conditions recorded.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {patient.conditions.map((c, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {c.name}
                            {c.status === "Resolved" && (
                              <span className="ml-1 text-muted-foreground">(resolved)</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Medications */}
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                      Medications
                    </p>
                    {patient.medications.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No medications recorded.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {patient.medications.map((m, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{m.name}</span>
                            <span className="text-muted-foreground text-xs">
                              {m.dose} · {m.frequency}
                            </span>
                            <Pill tone={m.status === "Active" ? "success" : "neutral"}>
                              {m.status}
                            </Pill>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Labs */}
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                      Recent Lab Results
                    </p>
                    {patient.labs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No lab results recorded.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {patient.labs.slice(0, 10).map((lab, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{lab.test}</span>
                            <span className="tabular-nums">
                              {lab.value} {lab.unit}
                            </span>
                            <Pill
                              tone={
                                lab.status === "CRITICAL"
                                  ? "danger"
                                  : lab.status === "HIGH" || lab.status === "LOW"
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {lab.status}
                            </Pill>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Encounter history from patient JSON */}
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
                      Visit History
                    </p>
                    {patient.encounters.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No visit history recorded.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {patient.encounters.map((enc, i) => (
                          <div
                            key={i}
                            className="flex items-start justify-between rounded-md border px-3 py-2 text-sm"
                          >
                            <div>
                              <span className="font-medium">{enc.type}</span>
                              <span className="text-muted-foreground ml-2 text-xs">
                                {enc.reason}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">
                              {enc.date} · {enc.provider}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Audit / Activity Log */}
              {tab === "audit" && (
                <div className="space-y-1.5 p-3">
                  {auditLogs.length === 0 ? (
                    <EmptyState
                      icon={ClipboardList}
                      title="No activity logs"
                      description="No audit events found for this patient."
                    />
                  ) : (
                    auditLogs.map((a) => (
                      <div
                        key={a.audit_id}
                        className="flex items-start justify-between gap-4 rounded-md border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm">{a.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.user} · {a.role}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono text-muted-foreground">
                            {a.timestamp
                              ? new Date(a.timestamp).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </p>
                          <Pill tone={a.result === "Failed" ? "danger" : a.result === "Success" ? "success" : "neutral"}>
                            {a.result}
                          </Pill>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EncounterCard({
  encounter,
}: {
  encounter: {
    encounter_id: string;
    doctor_name: string;
    status: string;
    soap_subjective: string | null;
    soap_objective: string | null;
    soap_assessment: string | null;
    soap_plan: string | null;
    finalized_at: string | null;
    created_at: string | null;
    approved_medications: Record<string, unknown>[];
    approved_labs: Record<string, unknown>[];
    approved_icd_codes: Record<string, unknown>[];
  };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <p className="font-medium text-sm">
            Consultation with {encounter.doctor_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {encounter.created_at
              ? new Date(encounter.created_at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—"}{" "}
            · {encounter.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={encounter.status === "Finalized" ? "success" : "warning"}>
            {encounter.status}
          </Pill>
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t p-3 space-y-3 text-sm">
          {encounter.soap_subjective && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Subjective</p>
              <p className="mt-1">{encounter.soap_subjective}</p>
            </div>
          )}
          {encounter.soap_objective && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Objective</p>
              <p className="mt-1">{encounter.soap_objective}</p>
            </div>
          )}
          {encounter.soap_assessment && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Assessment</p>
              <p className="mt-1">{encounter.soap_assessment}</p>
            </div>
          )}
          {encounter.soap_plan && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Plan</p>
              <p className="mt-1">{encounter.soap_plan}</p>
            </div>
          )}
          {encounter.approved_medications.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Medications Prescribed</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {encounter.approved_medications.map((m, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {String((m as { name?: unknown }).name ?? JSON.stringify(m))}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PatientsPage() {
  const { data: patients, isLoading, isError, refetch } = usePatients();
  const { can, user } = useSession();
  const [term, setTerm] = useState("");
  const [risk, setRisk] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const isReceptionist = user?.role === "Receptionist";
  const isAdmin = user?.role === "Admin";

  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (patients ?? []).filter((p) => {
      const matches = !q || p.name.toLowerCase().includes(q) || p.patient_id.toLowerCase().includes(q);
      return (
        matches &&
        (risk === "all" || p.risk === risk) &&
        (status === "all" || p.workflow_status === status)
      );
    });
  }, [patients, term, risk, status]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  if (isError) {
    return (
      <>
        <PageHeader title="Patients" description="Patient roster." />
        <QueryError
          message="Couldn't load patients."
          onRetry={() => {
            void refetch();
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Patients Information"
        description="Patient roster. Reception can register walk-ins; doctors open records for consults."
        actions={
          can("registerPatient") ? (
            <Button asChild>
              <Link to="/receptionist/new-patient">
                <Plus className="mr-1.5 size-4" />
                New patient
              </Link>
            </Button>
          ) : null
        }
      />

      <Card className="shadow-card">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-3">
            <Input
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                setPage(0);
              }}
              placeholder="Search by patient name or ID…"
              className="max-w-sm"
              aria-label="Search patients"
            />
            <Select
              value={risk}
              onValueChange={(v) => {
                setRisk(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[170px]" aria-label="Filter by risk">
                <SelectValue placeholder="Risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All risk levels</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[190px]" aria-label="Filter by workflow status">
                <SelectValue placeholder="Workflow status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workflow states</SelectItem>
                <SelectItem value="Not Started">Not Started</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No patients match your filters"
              description="Try clearing the search box or resetting the risk and workflow status filters."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Age / Gender</TableHead>
                      <TableHead>Primary conditions</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Workflow</TableHead>
                      <TableHead className="text-right">Issues</TableHead>
                      <TableHead className="text-right">Referrals</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((p) => (
                      <TableRow key={p.patient_id}>
                        <TableCell className="font-mono text-xs">{p.patient_id}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {p.age} ·{" "}
                          {p.gender === "Male"
                            ? "M"
                            : p.gender === "Female"
                              ? "F"
                              : p.gender || "—"}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">
                          {p.conditions
                            .slice(0, 2)
                            .map((c) => c.name)
                            .join(", ") || "None recorded"}
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={p.risk} suffix=" Risk" />
                        </TableCell>
                        <TableCell>
                          <WorkflowStatusBadge status={p.workflow_status} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.issues_count}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.referrals_count}</TableCell>
                        <TableCell className="text-right">
                          {isAdmin ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setHistoryPatient(p)}
                                aria-label={`View history for ${p.name}`}
                              >
                                <Info className="mr-1 size-3.5" />
                                Info
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => setEditingPatient(p)}
                                aria-label={`Edit ${p.name}`}
                              >
                                <Pencil className="mr-1 size-3.5" />
                                Edit
                              </Button>
                            </div>
                          ) : (
                            <Button asChild variant="outline" size="sm">
                              {isReceptionist ? (
                                <Link
                                  to="/receptionist/triage/$patientId"
                                  params={{ patientId: p.patient_id }}
                                >
                                  View
                                </Link>
                              ) : (
                                <Link to="/patients/$patientId" params={{ patientId: p.patient_id }}>
                                  View
                                </Link>
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-sm text-muted-foreground">
                  Showing {current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} of{" "}
                  {rows.length} patients
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current === 0}
                    onClick={() => setPage(current - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current >= pageCount - 1}
                    onClick={() => setPage(current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EditPatientDialog
        patient={editingPatient}
        open={Boolean(editingPatient)}
        onClose={() => setEditingPatient(null)}
      />
      <PatientHistoryDialog
        patient={historyPatient}
        open={Boolean(historyPatient)}
        onClose={() => setHistoryPatient(null)}
      />
    </>
  );
}