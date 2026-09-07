import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Pill } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { auditQuery } from "@/hooks/useClinicalQueries";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — ClinicalFlow AI" },
      {
        name: "description",
        content:
          "Immutable audit log of every agent action, referral change and rule update across the clinical workflow demo.",
      },
      { property: "og:title", content: "Audit Trail — ClinicalFlow AI" },
      {
        property: "og:description",
        content: "Traceability log covering agent executions, referrals and user actions.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { data: entries, isLoading } = useQuery(auditQuery());
  const [term, setTerm] = useState("");
  const [result, setResult] = useState("all");

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (entries ?? []).filter((e) => {
      const matches =
        !q ||
        e.action.toLowerCase().includes(q) ||
        e.user.toLowerCase().includes(q) ||
        (e.patient_id ?? "").toLowerCase().includes(q);
      return matches && (result === "all" || e.result === result);
    });
  }, [entries, term, result]);

  return (
    <>
      <PageHeader
        title="Audit Trail"
        description="Every agent execution and user action is recorded for traceability and compliance review."
      />

      <Card className="shadow-card">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-3">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search action, user or patient ID…"
              className="max-w-sm"
              aria-label="Search audit trail"
            />
            <Select value={result} onValueChange={setResult}>
              <SelectTrigger className="w-[180px]" aria-label="Filter by result">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All results</SelectItem>
                <SelectItem value="Success">Success</SelectItem>
                <SelectItem value="Info">Info</SelectItem>
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
              icon={FileClock}
              title="No audit entries yet"
              description="Run a clinical workflow or create a referral and every action will appear here with a timestamp."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow key={e.audit_id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {new Date(e.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{e.user}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{e.role}</TableCell>
                      <TableCell className="min-w-[280px]">{e.action}</TableCell>
                      <TableCell className="font-mono text-xs">{e.patient_id ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.agent ?? "—"}</TableCell>
                      <TableCell>
                        <Pill
                          tone={
                            e.result === "Success" ? "success" : e.result === "Failed" ? "danger" : "info"
                          }
                        >
                          {e.result}
                        </Pill>
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