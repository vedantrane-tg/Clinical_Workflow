import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { AgentGraph } from "@/components/workflow/AgentGraph";
import { WorkflowStatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { agentStatusQuery, workflowsQuery } from "@/hooks/useClinicalQueries";

export const Route = createFileRoute("/workflows")({
  head: () => ({
    meta: [
      { title: "Workflow Monitor — ClinicalFlow AI" },
      {
        name: "description",
        content:
          "Live monitor of multi-agent clinical workflow executions with per-agent status, duration and outputs.",
      },
      { property: "og:title", content: "Workflow Monitor — ClinicalFlow AI" },
      {
        property: "og:description",
        content: "Track EHR extraction, summarisation and referral orchestration runs end to end.",
      },
    ],
  }),
  component: WorkflowsPage,
});

function WorkflowsPage() {
  const { data: workflows, isLoading } = useQuery({ ...workflowsQuery(), refetchInterval: 2000 });
  const { data: agents } = useQuery({ ...agentStatusQuery(), refetchInterval: 2000 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = workflows ?? [];
  const selected = useMemo(
    () => list.find((w) => w.workflow_id === selectedId) ?? list[0] ?? null,
    [list, selectedId],
  );

  return (
    <>
      <PageHeader
        title="Workflow Monitor"
        description="Every agent execution, its status transitions and timing across the clinical workflow graph."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {(agents ?? []).map((a) => (
          <Card key={a.agent_id} className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{a.name}</CardTitle>
              <CardDescription>Lifetime executions this session</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-6 text-sm">
              <div>
                <p className="text-xl font-semibold tabular-nums text-success">{a.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums text-info">{a.processing}</p>
                <p className="text-xs text-muted-foreground">Processing</p>
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums text-destructive">{a.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No workflow executions yet"
          description="Open a patient and run the clinical workflow to see the agent graph execute here in real time."
          action={
            <Button asChild>
              <Link to="/patients">Go to patients</Link>
            </Button>
          }
        />
      ) : (
        <>
          {selected ? (
            <Card className="shadow-card">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">{selected.patient_name}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {selected.workflow_id} · {selected.patient_id}
                  </CardDescription>
                </div>
                <WorkflowStatusBadge status={selected.status} />
              </CardHeader>
              <CardContent>
                <AgentGraph execution={selected} />
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Execution history</CardTitle>
              <CardDescription>Select a run to inspect its agent graph.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current agent</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((w) => (
                    <TableRow
                      key={w.workflow_id}
                      onClick={() => setSelectedId(w.workflow_id)}
                      className="cursor-pointer"
                      data-state={selected?.workflow_id === w.workflow_id ? "selected" : undefined}
                    >
                      <TableCell className="font-mono text-xs">{w.workflow_id}</TableCell>
                      <TableCell className="font-medium">{w.patient_name}</TableCell>
                      <TableCell>
                        <WorkflowStatusBadge status={w.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{w.current_agent ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(w.started_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {w.duration_ms != null ? `${(w.duration_ms / 1000).toFixed(1)}s` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}