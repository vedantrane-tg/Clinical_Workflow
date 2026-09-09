import { ArrowRight, Brain, Database, Send } from "lucide-react";
import type { AgentId, AgentStep, WorkflowExecution } from "@/types/clinical";
import { AgentStatusBadge } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";

const AGENT_META: Record<AgentId, { title: string; icon: typeof Brain; blurb: string }> = {
  "ehr-extractor": {
    title: "EHR Extractor Agent",
    icon: Database,
    blurb: "Pulls demographics, conditions, medications, encounters and labs from the FHIR store.",
  },
  "patient-summary": {
    title: "Patient Summary Agent",
    icon: Brain,
    blurb: "Generates a structured clinical summary and flags abnormal findings and conflicts.",
  },
  "referral-orchestrator": {
    title: "Referral Orchestrator Agent",
    icon: Send,
    blurb: "Applies referral rules, selects a specialist and dispatches the referral notification.",
  },
};

const ORDER: AgentId[] = ["ehr-extractor", "patient-summary", "referral-orchestrator"];

function stepFor(execution: WorkflowExecution | null, id: AgentId): AgentStep | null {
  return execution?.agent_steps.find((s) => s.agent_id === id) ?? null;
}

export function AgentGraph({
  execution,
  onSelect,
  selected,
}: {
  execution: WorkflowExecution | null;
  onSelect?: (agentId: AgentId) => void;
  selected?: AgentId | null;
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
      {ORDER.map((id, index) => {
        const step = stepFor(execution, id);
        const meta = AGENT_META[id];
        const status = step?.status ?? "Waiting";
        const Icon = meta.icon;
        return (
          <div key={id} className="flex flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => onSelect?.(id)}
              className={cn(
                "w-full rounded-lg border bg-surface p-4 text-left transition-all",
                status === "Running" && "border-info shadow-elevated ring-2 ring-info/25",
                status === "Completed" && "border-success/40",
                status === "Failed" && "border-destructive/50",
                status === "Waiting" && "border-border",
                selected === id && "ring-2 ring-primary/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                    status === "Completed"
                      ? "bg-success/10 text-success"
                      : status === "Running"
                        ? "bg-info/10 text-info"
                        : status === "Failed"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-secondary text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-4", status === "Running" && "animate-pulse")} aria-hidden />
                </span>
                <AgentStatusBadge status={status} />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">{meta.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{step?.output_summary ?? meta.blurb}</p>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {step?.duration_ms != null ? `${(step.duration_ms / 1000).toFixed(1)}s` : "—"}
                {step?.error ? ` · ${step.error}` : ""}
              </p>
            </button>
            {index < ORDER.length - 1 ? (
              <ArrowRight className="hidden size-5 shrink-0 text-muted-foreground lg:block" aria-hidden />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}