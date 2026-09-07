import { cn } from "@/lib/utils";
import type { AgentStatus, ReferralStatus, Severity, WorkflowStatus } from "@/types/clinical";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "critical";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  info: "bg-info/10 text-info border-info/30",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
  critical: "bg-critical text-critical-foreground border-critical",
};

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const WORKFLOW_TONE: Record<WorkflowStatus, Tone> = {
  "Not Started": "neutral",
  Queued: "neutral",
  Extracting: "info",
  Summarizing: "info",
  "Orchestrating Referral": "info",
  Completed: "success",
  Failed: "danger",
};

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const active = ["Extracting", "Summarizing", "Orchestrating Referral", "Queued"].includes(status);
  return (
    <Pill tone={WORKFLOW_TONE[status]}>
      {active && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {status}
    </Pill>
  );
}

const REFERRAL_TONE: Record<ReferralStatus, Tone> = {
  Pending: "warning",
  Created: "info",
  Contacted: "info",
  Scheduled: "info",
  Completed: "success",
  Cancelled: "neutral",
};

export function ReferralStatusBadge({ status }: { status: ReferralStatus | "Not Referred" }) {
  if (status === "Not Referred") return <Pill tone="neutral">Not referred</Pill>;
  return <Pill tone={REFERRAL_TONE[status]}>{status}</Pill>;
}

const SEVERITY_TONE: Record<Severity, Tone> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

export function SeverityBadge({ severity, suffix }: { severity: Severity; suffix?: string }) {
  return (
    <Pill tone={SEVERITY_TONE[severity]}>
      {severity}
      {suffix ?? " Priority"}
    </Pill>
  );
}

const AGENT_TONE: Record<AgentStatus, Tone> = {
  Waiting: "neutral",
  Running: "info",
  Completed: "success",
  Failed: "danger",
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <Pill tone={AGENT_TONE[status]}>
      {status === "Running" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {status}
    </Pill>
  );
}

export function LabStatusBadge({ status }: { status: "NORMAL" | "HIGH" | "LOW" | "CRITICAL" }) {
  const tone: Tone =
    status === "NORMAL" ? "success" : status === "CRITICAL" ? "critical" : status === "LOW" ? "warning" : "danger";
  return <Pill tone={tone}>{status}</Pill>;
}