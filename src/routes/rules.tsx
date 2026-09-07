import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Pill, SeverityBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { rulesQuery, useToggleRule } from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Referral Rules — ClinicalFlow AI" },
      {
        name: "description",
        content:
          "Configurable clinical rule set that drives automated specialist referral decisions in the agentic workflow.",
      },
      { property: "og:title", content: "Referral Rules — ClinicalFlow AI" },
      {
        property: "og:description",
        content: "Inspect and toggle the JSON-driven rules used by the Referral Orchestrator Agent.",
      },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  const { data: rules, isLoading } = useQuery(rulesQuery());
  const { user, can } = useSession();
  const toggle = useToggleRule({ name: user.name, role: user.role });
  const editable = can("editRules");

  return (
    <>
      <PageHeader
        title="Referral Rules"
        description="Deterministic clinical rules the Referral Orchestrator Agent evaluates against extracted EHR data."
      />

      {!editable ? (
        <p className="text-sm text-muted-foreground">
          Rules are read-only for the Care Coordinator role. Switch to Clinician to enable editing.
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(rules ?? []).map((rule) => (
            <Card key={rule.rule_id} className="shadow-card">
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">{rule.condition}</CardTitle>
                  <CardDescription className="font-mono text-xs">{rule.rule_id}</CardDescription>
                </div>
                <Switch
                  checked={rule.enabled}
                  disabled={!editable || toggle.isPending}
                  aria-label={`Toggle rule ${rule.rule_id}`}
                  onCheckedChange={(next) =>
                    toggle.mutate(
                      { ruleId: rule.rule_id, enabled: next },
                      {
                        onSuccess: () =>
                          toast.success(`${rule.rule_id} ${next ? "enabled" : "disabled"}`),
                      },
                    )
                  }
                />
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-md bg-surface-muted px-3 py-2 font-mono text-xs text-foreground">
                  IF {rule.trigger} → refer to {rule.specialist}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="info">{rule.specialist}</Pill>
                  <SeverityBadge severity={rule.priority} />
                  <Pill tone={rule.enabled ? "success" : "neutral"}>
                    {rule.enabled ? "Active" : "Inactive"}
                  </Pill>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}