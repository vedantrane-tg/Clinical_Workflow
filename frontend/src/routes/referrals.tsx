import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ReferralStatusBadge, SeverityBadge } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { referralsQuery, useUpdateReferral } from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";
import type { ReferralStatus } from "@/types/clinical";

const STATUSES: ReferralStatus[] = [
  "Pending",
  "Created",
  "Contacted",
  "Scheduled",
  "Completed",
  "Cancelled",
];

export const Route = createFileRoute("/referrals")({
  head: () => ({
    meta: [
      { title: "Referrals — ClinicalFlow AI" },
      {
        name: "description",
        content:
          "All agent-generated and manually created specialist referrals with priority, assigned specialist and status tracking.",
      },
      { property: "og:title", content: "Referrals — ClinicalFlow AI" },
      {
        property: "og:description",
        content: "Track and update specialist referrals produced by the Referral Orchestrator Agent.",
      },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const { data: referrals, isLoading } = useQuery(referralsQuery());
  const { user, can } = useSession();
  const update = useUpdateReferral({ name: user.name, role: user.role });
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (referrals ?? []).filter((r) => {
      const matches =
        !q ||
        r.patient_name.toLowerCase().includes(q) ||
        r.referral_id.toLowerCase().includes(q) ||
        (r.specialist_name ?? "").toLowerCase().includes(q);
      return (
        matches &&
        (status === "all" || r.status === status) &&
        (priority === "all" || r.priority === priority)
      );
    });
  }, [referrals, term, status, priority]);

  return (
    <>
      <PageHeader
        title="Referrals"
        description="Referrals created automatically by the orchestrator agent or manually by care staff."
      />

      <Card className="shadow-card">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-3">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search patient, specialist or referral ID…"
              className="max-w-sm"
              aria-label="Search referrals"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[170px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-[170px]" aria-label="Filter by priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No referrals yet"
              description="Run the clinical workflow on a patient — the Referral Orchestrator Agent will create referrals here."
              action={
                <Button asChild>
                  <Link to="/patients">Go to patients</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referral ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Specialist</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.referral_id}>
                      <TableCell className="font-mono text-xs">{r.referral_id}</TableCell>
                      <TableCell>
                        <Link
                          to="/patients/$patientId"
                          params={{ patientId: r.patient_id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {r.patient_name}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[260px] text-muted-foreground">{r.issue}</TableCell>
                      <TableCell>
                        <p className="font-medium">{r.specialist_name ?? "Unassigned"}</p>
                        <p className="text-xs text-muted-foreground">{r.specialist_type}</p>
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={r.priority} />
                      </TableCell>
                      <TableCell>
                        <ReferralStatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={r.status}
                          disabled={!can("overrideReferral") && !can("createReferral")}
                          onValueChange={(next) =>
                            update.mutate(
                              { id: r.referral_id, patch: { status: next as ReferralStatus } },
                              { onSuccess: () => toast.success(`${r.referral_id} → ${next}`) },
                            )
                          }
                        >
                          <SelectTrigger className="ml-auto w-[150px]" aria-label="Update referral status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}