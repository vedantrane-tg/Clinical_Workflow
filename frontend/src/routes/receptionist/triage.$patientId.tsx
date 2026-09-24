import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryError } from "@/components/common/QueryError";
import { AcuityBadge, Pill } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { patientQuery, useCheckinPatient } from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";
import type { TriageResult } from "@/types/clinical";

export const Route = createFileRoute("/receptionist/triage/$patientId")({
  head: ({ params }) => ({
    meta: [
      { title: `Triage ${params.patientId} — ClinicalFlow AI` },
      { name: "description", content: "Run smart triage for a checked-in patient." },
    ],
  }),
  component: TriageStationPage,
});

function TriageStationPage() {
  const { patientId } = Route.useParams();
  const { user, can } = useSession();
  const navigate = useNavigate();
  const { data: patient, isLoading, isError, refetch } = useQuery(patientQuery(patientId));
  const checkin = useCheckinPatient(patientId);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);

  if (!can("runTriage") && !can("viewClinic")) {
    return <Navigate to="/" />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <QueryError
        message="Couldn’t load this patient for triage."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  async function runTriage() {
    const complaint = chiefComplaint.trim();
    if (complaint.length < 3) {
      toast.error("Enter a chief complaint (at least 3 characters)");
      return;
    }
    try {
      const triage = await checkin.mutateAsync({
        chief_complaint: complaint,
        actor_name: user?.name ?? "Receptionist",
        actor_role: user?.role ?? "Receptionist",
      });
      setResult(triage);
      toast.success("Triage complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Triage failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Triage Station"
        description={`${patient.name} · ${patient.patient_id} · ${patient.age}${patient.gender?.[0] ?? ""}`}
        actions={
          <Button asChild variant="outline">
            <Link to="/patients">Patients</Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Chief complaint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chief_complaint">Today&apos;s reason for visit</Label>
              <Textarea
                id="chief_complaint"
                rows={6}
                placeholder="e.g. Blurry vision and tingling feet for 2 months"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={!can("runTriage") || checkin.isPending}
              onClick={() => void runTriage()}
            >
              {checkin.isPending ? "Running Smart Triage…" : "Run Smart Triage"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Patient history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-foreground">Conditions</p>
              {patient.conditions?.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  {patient.conditions.map((c, i) => (
                    <li key={`${c.name}-${i}`}>
                      {c.name}
                      {c.code ? ` (${c.code})` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted-foreground">None documented</p>
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">Medications</p>
              {patient.medications?.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  {patient.medications.map((m, i) => (
                    <li key={`${m.name}-${i}`}>
                      {m.name}
                      {m.dose ? ` — ${m.dose}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted-foreground">None documented</p>
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">Recent labs</p>
              {patient.labs?.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                  {patient.labs.slice(0, 5).map((l, i) => (
                    <li key={`${l.test}-${i}`}>
                      {l.test}: {l.value} {l.unit} ({l.status})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-muted-foreground">None documented</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {result ? (
        <Card className="shadow-card">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Triage result</CardTitle>
            <div className="flex flex-wrap gap-2">
              <AcuityBadge level={result.acuity_level} />
              <Pill tone="info">{result.recommended_specialty}</Pill>
              <Pill tone="neutral">{Math.round(result.confidence_score * 100)}% confidence</Pill>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Doctor:</span>{" "}
                {result.recommended_doctor_name ?? "Unassigned"}{" "}
                {result.recommended_doctor_id ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    ({result.recommended_doctor_id})
                  </span>
                ) : null}
              </p>
              <p>
                <span className="text-muted-foreground">Model:</span> {result.model}
              </p>
            </div>

            <div>
              <p className="mb-1 font-medium">Pre-visit brief</p>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm">
                {result.pre_visit_brief}
              </pre>
            </div>

            {result.brief_sections?.length ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {result.brief_sections.map((section) => (
                  <div key={section.heading} className="rounded-md border border-border p-3">
                    <p className="font-medium">{section.heading}</p>
                    <p className="mt-1 text-muted-foreground">{section.body}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() =>
                  void navigate({
                    to: "/receptionist/checkout/$patientId",
                    params: { patientId },
                  })
                }
              >
                Proceed to payment
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
