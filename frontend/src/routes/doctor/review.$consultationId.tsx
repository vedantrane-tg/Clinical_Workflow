import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Pill } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { clinicalApi } from "@/api/clinicalApi";
import { useSession } from "@/hooks/useSession";
import type { Encounter } from "@/types/clinical";

export const Route = createFileRoute("/doctor/review/$consultationId")({
  head: ({ params }) => ({
    meta: [
      { title: `Orders ${params.consultationId} — ClinicalFlow AI` },
      { name: "description", content: "Review CDS suggestions and finalize the encounter." },
    ],
  }),
  component: ClinicalOrdersPage,
});

type SelectedMap = Record<string, boolean>;

function itemKey(prefix: string, item: Record<string, unknown>, index: number) {
  return `${prefix}-${index}-${JSON.stringify(item)}`;
}

function ClinicalOrdersPage() {
  const { consultationId } = Route.useParams();
  const { user, can } = useSession();
  const navigate = useNavigate();

  const consultationQuery = useQuery({
    queryKey: ["consultations", consultationId],
    queryFn: () => clinicalApi.getConsultation(consultationId),
  });

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [cdsLoading, setCdsLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState("");
  const [selectedLabs, setSelectedLabs] = useState<SelectedMap>({});
  const [selectedMeds, setSelectedMeds] = useState<SelectedMap>({});
  const [selectedIcds, setSelectedIcds] = useState<SelectedMap>({});
  const [selectedRefs, setSelectedRefs] = useState<SelectedMap>({});

  const consultation = consultationQuery.data;

  useEffect(() => {
    if (!consultation?.soap_note || encounter || cdsLoading) return;
    let cancelled = false;
    (async () => {
      setCdsLoading(true);
      try {
        const result = await clinicalApi.runCds(consultationId, {
          actor_name: user?.name ?? "Doctor",
          actor_role: user?.role ?? "Doctor",
        });
        if (cancelled) return;
        setEncounter(result);
        setSelectedLabs(defaultSelected(result.suggested_labs, "labs"));
        setSelectedMeds(defaultSelected(result.suggested_medications, "meds"));
        setSelectedIcds(defaultSelected(result.suggested_icd_codes, "icd"));
        setSelectedRefs(defaultSelected(result.suggested_referrals, "ref"));
        toast.success("CDS suggestions ready");
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "CDS failed");
        }
      } finally {
        if (!cancelled) setCdsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultation?.consultation_id, consultation?.soap_note]);

  const soapSummary = useMemo(() => {
    if (!consultation?.soap_note && !encounter) return null;
    return {
      subjective: encounter?.soap_subjective ?? consultation?.soap_note?.subjective,
      objective: encounter?.soap_objective ?? consultation?.soap_note?.objective,
      assessment: encounter?.soap_assessment ?? consultation?.soap_note?.assessment,
      plan: encounter?.soap_plan ?? consultation?.soap_note?.plan,
    };
  }, [consultation, encounter]);

  if (!can("signEncounter")) {
    return <Navigate to="/" />;
  }

  if (consultationQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <>
        <PageHeader title="Clinical orders" description="Consultation not found." />
        <Button asChild variant="outline">
          <Link to="/">Back to queue</Link>
        </Button>
      </>
    );
  }

  async function finalize() {
    if (!encounter) {
      toast.error("Run CDS first");
      return;
    }
    setFinalizing(true);
    try {
      const approved_labs = pickSelected(encounter.suggested_labs, selectedLabs, "labs");
      const approved_medications = pickSelected(
        encounter.suggested_medications,
        selectedMeds,
        "meds",
      );
      const approved_icd_codes = pickSelected(encounter.suggested_icd_codes, selectedIcds, "icd");
      const approved_referrals = pickSelected(encounter.suggested_referrals, selectedRefs, "ref");

      const finalized = await clinicalApi.finalizeEncounter(encounter.encounter_id, {
        approved_labs,
        approved_medications,
        approved_icd_codes,
        approved_referrals,
        doctor_notes: doctorNotes.trim() || null,
        actor_name: user?.name ?? "Doctor",
        actor_role: user?.role ?? "Doctor",
      });
      setEncounter(finalized);
      toast.success("Encounter finalized");
      void navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Finalize failed");
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Clinical orders & sign-off"
        description={`${consultation.consultation_id} · patient ${consultation.patient_id ?? "—"}`}
        actions={
          consultation.patient_id ? (
            <Button asChild variant="outline">
              <Link
                to="/doctor/consult/$patientId"
                params={{ patientId: consultation.patient_id }}
              >
                Back to consult
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/">Back to queue</Link>
            </Button>
          )
        }
      />

      {soapSummary ? (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">SOAP summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
            <SoapMini title="S" body={soapSummary.subjective} />
            <SoapMini title="O" body={soapSummary.objective} />
            <SoapMini title="A" body={soapSummary.assessment} />
            <SoapMini title="P" body={soapSummary.plan} />
          </CardContent>
        </Card>
      ) : null}

      {cdsLoading ? (
        <Card className="shadow-card">
          <CardContent className="py-8 text-sm text-muted-foreground">
            Running Clinical Decision Support…
          </CardContent>
        </Card>
      ) : null}

      {encounter ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <SuggestionPanel
              title="Lab orders"
              items={encounter.suggested_labs}
              prefix="labs"
              selected={selectedLabs}
              onToggle={(key, checked) =>
                setSelectedLabs((prev) => ({ ...prev, [key]: checked }))
              }
              renderLabel={(item) =>
                `${String(item.test ?? "Test")}${item.priority ? ` (${String(item.priority)})` : ""}`
              }
              renderHint={(item) => String(item.reason ?? "")}
            />
            <SuggestionPanel
              title="Medications"
              items={encounter.suggested_medications}
              prefix="meds"
              selected={selectedMeds}
              onToggle={(key, checked) =>
                setSelectedMeds((prev) => ({ ...prev, [key]: checked }))
              }
              renderLabel={(item) => {
                const name = String(item.name ?? "Medication");
                const dose = item.dose ? ` ${String(item.dose)}` : "";
                const freq = item.frequency ? ` ${String(item.frequency)}` : "";
                return `${name}${dose}${freq}`;
              }}
              renderHint={(item) => String(item.reason ?? "")}
            />
            <SuggestionPanel
              title="ICD-10 codes"
              items={encounter.suggested_icd_codes}
              prefix="icd"
              selected={selectedIcds}
              onToggle={(key, checked) =>
                setSelectedIcds((prev) => ({ ...prev, [key]: checked }))
              }
              renderLabel={(item) =>
                `${String(item.code ?? "")} — ${String(item.description ?? "")}`
              }
            />
            <SuggestionPanel
              title="Referrals"
              items={encounter.suggested_referrals}
              prefix="ref"
              selected={selectedRefs}
              onToggle={(key, checked) =>
                setSelectedRefs((prev) => ({ ...prev, [key]: checked }))
              }
              renderLabel={(item) =>
                `${String(item.specialty ?? "Specialty")}${item.urgency ? ` (${String(item.urgency)})` : ""}`
              }
              renderHint={(item) => String(item.reason ?? "")}
            />
          </div>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Doctor notes & finalize</CardTitle>
              <Pill tone={encounter.status === "Finalized" ? "success" : "info"}>
                {encounter.status}
              </Pill>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="doctor_notes">Notes</Label>
                <Textarea
                  id="doctor_notes"
                  rows={3}
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Optional notes for the chart"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button asChild variant="outline">
                  <Link to="/">Cancel</Link>
                </Button>
                <Button
                  type="button"
                  disabled={finalizing || encounter.status === "Finalized"}
                  onClick={() => void finalize()}
                >
                  {finalizing ? "Finalizing…" : "Sign & finalize encounter"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </>
  );
}

function defaultSelected(items: Record<string, unknown>[], prefix: string): SelectedMap {
  const map: SelectedMap = {};
  items.forEach((item, index) => {
    const key = itemKey(prefix, item, index);
    const priority = String(item.priority ?? "").toLowerCase();
    map[key] = priority === "required" || priority === "";
  });
  // If nothing marked required, pre-check all
  if (Object.values(map).every((v) => !v)) {
    Object.keys(map).forEach((k) => {
      map[k] = true;
    });
  }
  return map;
}

function pickSelected(
  items: Record<string, unknown>[],
  selected: SelectedMap,
  prefix: string,
): Record<string, unknown>[] {
  return items.filter((item, index) => selected[itemKey(prefix, item, index)]);
}

function SuggestionPanel({
  title,
  items,
  prefix,
  selected,
  onToggle,
  renderLabel,
  renderHint,
}: {
  title: string;
  items: Record<string, unknown>[];
  prefix: string;
  selected: SelectedMap;
  onToggle: (key: string, checked: boolean) => void;
  renderLabel: (item: Record<string, unknown>) => string;
  renderHint?: (item: Record<string, unknown>) => string;
}) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions</p>
        ) : (
          items.map((item, index) => {
            const key = itemKey(prefix, item, index);
            return (
              <label key={key} className="flex items-start gap-3 rounded-md border border-border p-3">
                <Checkbox
                  checked={Boolean(selected[key])}
                  onCheckedChange={(v) => onToggle(key, Boolean(v))}
                />
                <span className="min-w-0 text-sm">
                  <span className="font-medium text-foreground">{renderLabel(item)}</span>
                  {renderHint?.(item) ? (
                    <span className="mt-1 block text-muted-foreground">{renderHint(item)}</span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function SoapMini({ title, body }: { title: string; body?: string | null }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{body?.trim() || "—"}</p>
    </div>
  );
}
