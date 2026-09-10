import { createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ClinicalFlow AI" },
      {
        name: "description",
        content: "Application and environment settings.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Application and environment settings."
      />

      <EmptyState
        icon={Clock}
        title="Pending..."
        description="This section is currently under development."
      />
    </>
  );
}