import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { SeverityBadge, WorkflowStatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatients } from "@/hooks/useClinicalQueries";

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

function PatientsPage() {
  const { data: patients, isLoading } = usePatients();
  const [term, setTerm] = useState("");
  const [risk, setRisk] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

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

  return (
    <>
      <PageHeader
        title="Patients"
        description="Synthetic patient roster. Open a record to run the multi-agent clinical workflow."
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
                          {p.age} · {p.gender}
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
                          <Button asChild variant="outline" size="sm">
                            <Link to="/patients/$patientId" params={{ patientId: p.patient_id }}>
                              View
                            </Link>
                          </Button>
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
    </>
  );
}