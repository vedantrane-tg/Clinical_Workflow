import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Disclaimer } from "@/components/common/Disclaimer";
import { EmptyState } from "@/components/common/EmptyState";
import { AgentGraph } from "@/components/workflow/AgentGraph";
import {
  LabStatusBadge,
  Pill,
  ReferralStatusBadge,
  SeverityBadge,
  WorkflowStatusBadge,
} from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ehrQuery,
  patientQuery,
  patientReferralsQuery,
  summaryQuery,
  useRunWorkflow,
} from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";
import type { WorkflowExecution } from "@/types/clinical";

export const Route = createFileRoute("/patients/$patientId")({
  head: ({ params }) => ({
    meta: [
      { title: `Patient ${params.patientId} — ClinicalFlow AI` },
      {
        name: "description",
        content:
          "Synthetic patient record with extracted EHR data, AI-generated clinical summary, flagged issues and specialist referrals.",
      },
      { property: "og:title", content: `Patient ${params.patientId} — ClinicalFlow AI` },
      {
        property: "og:description",
        content: "Run the multi-agent clinical workflow and review its outputs for this patient.",
      },
    ],
  }),
  component: PatientDetailPage,
});

function PatientDetailPage() {
  const { patientId } = Route.useParams();
  const { user, can } = useSession();
  const [live, setLive] = useState<WorkflowExecution | null>(null);

  const { data: patient, isLoading } = useQuery(patientQuery(patientId));
  const { data: ehr } = useQuery(ehrQuery(patientId));
  const { data: summary } = useQuery(summaryQuery(patientId));
  const { data: referrals } = useQuery(patientReferralsQuery(patientId));

  const runWorkflow = useRunWorkflow(patientId, { name: user.name, role: user.role }, setLive);

  useEffect(() => setLive(null), [patientId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Patient not found"
        description={`No synthetic record exists for ${patientId}.`}
        action={
          <Button asChild>
            <Link to="/patients">Back to patients</Link>
          </Button>
        }
      />
    );
  }

  const canRun = can("runWorkflow");
  const status = live?.status ?? patient.workflow_status;

  return (
    <>
      <Link
        to="/patients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to patients
      </Link>

      <PageHeader
        title={patient.name}
        description={`${patient.patient_id} · ${patient.age} yrs · ${patient.gender} · DOB ${patient.date_of_birth}`}
        actions={
          <>
            <SeverityBadge severity={patient.risk} suffix=" Risk" />
            <WorkflowStatusBadge status={status} />
            <Button
              disabled={!canRun || runWorkflow.isPending}
              onClick={() =>
                runWorkflow.mutate(undefined, {
                  onSuccess: (execution) => {
                    setLive(execution);
                    toast.success(
                      execution.status === "Completed"
                        ? "Clinical workflow completed"
                        : "Workflow finished with errors",
                    );
                  },
                  onError: () => toast.error("Workflow failed to run"),
                })
              }
            >
              <Play className="size-4" />
              {runWorkflow.isPending ? "Running workflow…" : "Run Clinical Workflow"}
            </Button>
          </>
        }
      />

      {!canRun ? (
        <p className="text-sm text-muted-foreground">
          Running workflows requires the Clinician role. Care Coordinators can view results and manage referrals.
        </p>
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Agent workflow</CardTitle>
          <CardDescription>
            EHR Extractor → Patient Summary → Referral Orchestrator, executed sequentially with full audit logging.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentGraph execution={live} />
        </CardContent>
      </Card>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">AI Summary</TabsTrigger>
          <TabsTrigger value="issues">Flagged Issues</TabsTrigger>
          <TabsTrigger value="ehr">EHR Data</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 pt-4">
          {!summary ? (
            <EmptyState
              icon={Sparkles}
              title="No summary generated yet"
              description="Run the clinical workflow to have the Patient Summary Agent generate a structured summary."
            />
          ) : (
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-base">Clinical summary</CardTitle>
                <CardDescription>
                  Generated {new Date(summary.generated_at).toLocaleString()} · {summary.model}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <Disclaimer />
                <p className="leading-relaxed text-foreground">{summary.summary}</p>
                {summary.sections.map((s) => (
                  <div key={s.heading}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {s.heading}
                    </p>
                    <p className="mt-1 leading-relaxed">{s.body}</p>
                  </div>
                ))}
                <Separator />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Key concerns
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {summary.concerns.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recommended actions
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {summary.recommended_actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {summary.medication_conflicts.length > 0 ? (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                      Medication conflicts
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {summary.medication_conflicts.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="issues" className="space-y-4 pt-4">
          {!summary || summary.issues.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No flagged issues"
              description="Run the clinical workflow — flagged issues with evidence and rule traceability will appear here."
            />
          ) : (
            summary.issues.map((issue) => (
              <Card key={issue.issue_id} className="shadow-card">
                <CardContent className="space-y-3 pt-6 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={issue.severity} />
                    <Pill tone="info">{issue.recommended_specialist}</Pill>
                    <ReferralStatusBadge status={issue.referral_status} />
                    {issue.rule_id ? <Pill tone="neutral">{issue.rule_id}</Pill> : null}
                  </div>
                  <p className="font-medium text-foreground">{issue.issue}</p>
                  <p className="text-muted-foreground">Evidence: {issue.evidence}</p>
                  <p className="text-xs text-muted-foreground">
                    Source: {issue.source} · Detected by {issue.detected_by}
                    {issue.rule_expression ? ` · Rule: ${issue.rule_expression}` : ""}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="ehr" className="space-y-4 pt-4">
          {!ehr ? (
            <EmptyState
              icon={Sparkles}
              title="EHR not extracted yet"
              description="The EHR Extractor Agent pulls structured FHIR data when the workflow runs."
            />
          ) : (
            <>
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-base">Laboratory results</CardTitle>
                  <CardDescription>
                    Extracted {new Date(ehr.extracted_at).toLocaleString()} from {ehr.source}
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Reference range</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ehr.labs.map((lab) => (
                        <TableRow key={`${lab.test}-${lab.date}`}>
                          <TableCell className="font-medium">{lab.test}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {lab.value} {lab.unit}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{lab.referenceRange}</TableCell>
                          <TableCell>
                            <LabStatusBadge status={lab.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{lab.date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-base">Conditions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {ehr.conditions.map((c) => (
                      <div key={c.code} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.codeSystem} {c.code} · onset {c.onsetDate}
                          </p>
                        </div>
                        <Pill tone={c.status === "Active" ? "warning" : "neutral"}>{c.status}</Pill>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-base">Medications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {ehr.medications.map((m) => (
                      <div key={m.name} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.dose} · {m.frequency} · since {m.startDate}
                          </p>
                        </div>
                        <Pill tone={m.status === "Active" ? "info" : "neutral"}>{m.status}</Pill>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="text-base">Recent encounters</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Provider</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ehr.encounters.map((e) => (
                        <TableRow key={`${e.date}-${e.type}`}>
                          <TableCell className="whitespace-nowrap">{e.date}</TableCell>
                          <TableCell>{e.type}</TableCell>
                          <TableCell className="text-muted-foreground">{e.provider}</TableCell>
                          <TableCell className="text-muted-foreground">{e.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4 pt-4">
          {!referrals || referrals.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No referrals for this patient"
              description="The Referral Orchestrator Agent creates referrals automatically when a rule triggers."
            />
          ) : (
            referrals.map((r) => (
              <Card key={r.referral_id} className="shadow-card">
                <CardContent className="space-y-2 pt-6 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{r.referral_id}</span>
                    <SeverityBadge severity={r.priority} />
                    <ReferralStatusBadge status={r.status} />
                  </div>
                  <p className="font-medium text-foreground">{r.issue}</p>
                  <p className="text-muted-foreground">
                    {r.specialist_name ?? "Unassigned"} · {r.specialist_type}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.agent_notes}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(r.created_at).toLocaleString()} by {r.created_by}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}