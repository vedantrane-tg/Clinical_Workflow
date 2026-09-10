import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Referral Rules — ClinicalFlow AI" },
      {
        name: "description",
        content: "Referral rules configuration.",
      },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  return (
    <>
      <PageHeader
        title="Referral Rules"
        description="Deterministic clinical rules configuration."
      />

      <EmptyState
        icon={Clock}
        title="Pending..."
        description="This section is currently under development."
      />
    </>
  );
}