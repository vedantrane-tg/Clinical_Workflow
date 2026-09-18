import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ClipboardPlus,
  Clock3,
  Send,
  Stethoscope,
  Users,
  UserRoundCheck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { Disclaimer } from "@/components/common/Disclaimer";
import { EmptyState } from "@/components/common/EmptyState";
import { QueryError } from "@/components/common/QueryError";
import {
  AcuityBadge,
  Pill,
  QueueStatusBadge,
  ReferralStatusBadge,
  SeverityBadge,
  WorkflowStatusBadge,
} from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  queueAllQuery,
  referralsQuery,
  usePatients,
  workflowsQuery,
} from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clinical Dashboard — ClinicalFlow AI" },
      {
        name: "description",
        content:
          "Operational dashboard for intake queues and doctor consults in the agentic clinical workflow.",
      },
    ],
  }),
  component: Dashboard,
});

const RISK_COLORS = ["var(--destructive)", "var(--warning)", "var(--success)"];

function formatWaitDuration(checkedInAt: string | null): string {
  if (!checkedInAt) return "—";
  const ms = Date.now() - new Date(checkedInAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

function Dashboard() {
  const { user } = useSession();
  if (user?.role === "Receptionist") return <ReceptionistDashboard />;
  if (user?.role === "Doctor") return <DoctorDashboard />;
  return <LegacyOpsDashboard />;
}

function ReceptionistDashboard() {
  const { data: patients, isLoading, isError, refetch } = usePatients();
  const {
    data: queues,
    isLoading: queuesLoading,
    isError: queuesError,
    refetch: refetchQueues,
  } = useQuery(queueAllQuery());

  const stats = useMemo(() => {
    const list = patients ?? [];
    const waiting = list.filter((p) => p.queue_status === "Waiting").length;
    const inConsult = list.filter((p) => p.queue_status === "In Consultation").length;
    const completed = list.filter((p) => p.queue_status === "Completed").length;
    const checkedIn = list.filter((p) => Boolean(p.checked_in_at)).length;
    return {
      registered: list.length,
      checkedIn,
      waiting,
      inConsult,
      completed,
    };
  }, [patients]);

  const waitingRows = useMemo(() => {
    return (queues ?? [])
      .flatMap((q) =>
        q.patients
          .filter((p) => p.queue_status === "Waiting")
          .map((p) => ({ ...p, doctor_name: q.doctor_name, specialty: q.specialty })),
      )
      .sort((a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999));
  }, [queues]);

  if (isLoading || queuesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || queuesError) {
    return (
      <QueryError
        message="Couldn’t load the intake dashboard."
        onRetry={() => {
          void refetch();
          void refetchQueues();
        }}
      />
    );
  }
let date = new Date();
let today = date.toLocaleDateString();
  return (
    <>
      <PageHeader
        title="Intake overview"
        description="Register patients, run triage, collect payment, and track the waiting queue."
        actions={
          <Button asChild>
            <Link to="/receptionist/new-patient">
              <ClipboardPlus className="mr-1.5 size-4" />
              New patient
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Reg Patient" value={stats.registered} icon={Users} />
        <KpiCard label={`Checked in ${today}`} value={stats.checkedIn} icon={UserRoundCheck} tone="success" />
        <KpiCard label="Waiting" value={stats.waiting} icon={Clock3} tone="warning" />
        <KpiCard label="In consultation" value={stats.inConsult} icon={Stethoscope} hint={`${stats.completed} completed`} />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Patient Onqueue</CardTitle>
          <CardDescription>Patients waiting after triage and payment routing.</CardDescription>
        </CardHeader>
        <CardContent>
          {waitingRows.length === 0 ? (
            <EmptyState
              icon={Clock3}
              title="No one waiting"
              description="Register a patient, run triage, then process payment to add them to a doctor queue."
              action={
                <Button asChild>
                  <Link to="/receptionist/new-patient">Register patient</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Complaint</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Wait</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waitingRows.map((row) => (
                  <TableRow key={row.patient_id}>
                    <TableCell className="tabular-nums">{row.queue_position ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      {row.name}
                      <div className="font-mono text-xs text-muted-foreground">{row.patient_id}</div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {row.chief_complaint ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div>{row.doctor_name}</div>
                      <div className="text-xs text-muted-foreground">{row.specialty}</div>
                    </TableCell>
                    <TableCell>{formatWaitDuration(row.checked_in_at)}</TableCell>
                    <TableCell>
                      {row.acuity_hint ? (
                        <AcuityBadge level={row.acuity_hint} />
                      ) : (
                        <SeverityBadge severity={(row.risk as "High" | "Medium" | "Low") || "Low"} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/receptionist/checkout/$patientId" params={{ patientId: row.patient_id }}>
                          Checkout
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function DoctorDashboard() {
  const { data: queues, isLoading, isError, refetch } = useQuery(queueAllQuery());

  const flat = useMemo(() => {
    return (queues ?? []).flatMap((q) =>
      q.patients.map((p) => ({
        ...p,
        doctor_id: q.doctor_id,
        doctor_name: q.doctor_name,
        specialty: q.specialty,
      })),
    );
  }, [queues]);

  const waiting = flat.filter((p) => p.queue_status === "Waiting");
  const inConsult = flat.filter((p) => p.queue_status === "In Consultation");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <QueryError
        message="Couldn’t load the doctor queue."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="My queue"
        description="Patients routed by triage. Start a consultation when ready."
        actions={
          <Button asChild variant="outline">
            <Link to="/patients">All patients</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Waiting" value={waiting.length} icon={Clock3} tone="warning" />
        <KpiCard label="In consultation" value={inConsult.length} icon={Stethoscope} />
        <KpiCard
          label="Active queues"
          value={(queues ?? []).filter((q) => q.patients.length > 0).length}
          icon={Activity}
        />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Assigned patients</CardTitle>
          <CardDescription>All specialty queues with waiting or in-consult patients.</CardDescription>
        </CardHeader>
        <CardContent>
          {flat.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="Queue is empty"
              description="When reception completes triage and payment, patients appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Complaint</TableHead>
                  <TableHead>Doctor / Specialty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acuity</TableHead>
                  <TableHead>Wait</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flat.map((row) => (
                  <TableRow key={`${row.doctor_id}-${row.patient_id}`}>
                    <TableCell className="tabular-nums">{row.queue_position ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      {row.name}
                      <div className="font-mono text-xs text-muted-foreground">{row.patient_id}</div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {row.chief_complaint ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div>{row.doctor_name}</div>
                      <div className="text-xs text-muted-foreground">{row.specialty}</div>
                    </TableCell>
                    <TableCell>
                      <QueueStatusBadge status={row.queue_status} />
                    </TableCell>
                    <TableCell>
                      {row.acuity_hint ? <AcuityBadge level={row.acuity_hint} /> : "—"}
                    </TableCell>
                    <TableCell>{formatWaitDuration(row.checked_in_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm">
                        <Link to="/doctor/consult/$patientId" params={{ patientId: row.patient_id }}>
                          Start consultation
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Fallback: previous ops charts if role is missing */
function LegacyOpsDashboard() {
  const { data: patients, isLoading } = usePatients();
  const { data: referrals } = useQuery(referralsQuery());
  const { data: workflows } = useQuery(workflowsQuery());

  const stats = useMemo(() => {
    const list = patients ?? [];
    const refs = referrals ?? [];
    const runs = workflows ?? [];
    const durations = runs.map((w) => w.duration_ms ?? 0).filter(Boolean);
    return {
      patients: list.length,
      issues: list.reduce((sum, p) => sum + p.issues_count, 0),
      referrals: refs.length,
      pending: refs.filter((r) => r.status === "Pending" || r.status === "Created").length,
      completedRuns: runs.filter((w) => w.status === "Completed").length,
      avgSeconds: durations.length
        ? (durations.reduce((a, b) => a + b, 0) / durations.length / 1000).toFixed(1)
        : "0.0",
      risk: (["High", "Medium", "Low"] as const).map((level) => ({
        name: level,
        value: list.filter((p) => p.risk === level).length,
      })),
      specialty: Object.entries(
        refs.reduce<Record<string, number>>((acc, r) => {
          acc[r.specialist_type] = (acc[r.specialist_type] ?? 0) + 1;
          return acc;
        }, {}),
      ).map(([name, value]) => ({ name, value })),
    };
  }, [patients, referrals, workflows]);

  const recentRuns = (workflows ?? []).slice(0, 5);
  const recentReferrals = (referrals ?? []).slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Clinical Dashboard"
        description="Operational overview of patients, agent workflow executions and specialist referrals."
        actions={
          <Button asChild>
            <Link to="/patients">Open patient roster</Link>
          </Button>
        }
      />
      <Disclaimer />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total patients" value={stats.patients} icon={Users} hint="Synthetic records" />
        <KpiCard
          label="Flagged issues"
          value={stats.issues}
          icon={AlertTriangle}
          tone="warning"
          hint="Detected by summary agent"
        />
        <KpiCard
          label="Referrals generated"
          value={stats.referrals}
          icon={Send}
          tone="success"
          hint={`${stats.pending} awaiting scheduling`}
        />
        <KpiCard
          label="Workflows completed"
          value={stats.completedRuns}
          icon={Activity}
          hint={`Avg ${stats.avgSeconds}s per run`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Patient risk distribution</CardTitle>
            <CardDescription>Risk stratification across the synthetic cohort.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.risk} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {stats.risk.map((entry, i) => (
                    <Cell key={entry.name} fill={RISK_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Referrals by specialty</CardTitle>
            <CardDescription>Where the orchestrator agent is routing patients.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {stats.specialty.length === 0 ? (
              <EmptyState
                icon={Send}
                title="No referrals yet"
                description="Run a clinical workflow on a patient to generate the first referral."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.specialty}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    cursor={{ fill: "var(--surface-muted)" }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Recent workflow runs</CardTitle>
            <CardDescription>Latest agent executions this session.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentRuns.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No workflow runs yet"
                description="Open a patient record and run the clinical workflow to populate this feed."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRuns.map((w) => (
                    <TableRow key={w.workflow_id}>
                      <TableCell className="font-medium">{w.patient_name}</TableCell>
                      <TableCell>
                        <WorkflowStatusBadge status={w.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {w.duration_ms != null ? `${(w.duration_ms / 1000).toFixed(1)}s` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Recent referrals</CardTitle>
            <CardDescription>Newest specialist assignments.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentReferrals.length === 0 ? (
              <EmptyState
                icon={Send}
                title="No referrals yet"
                description="Referrals appear here as soon as the orchestrator agent triggers a clinical rule."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Specialist</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReferrals.map((r) => (
                    <TableRow key={r.referral_id}>
                      <TableCell className="font-medium">{r.patient_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.specialist_type}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={r.priority} />
                      </TableCell>
                      <TableCell>
                        <ReferralStatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
