import { createFileRoute } from "@tanstack/react-router";
import { Cloud, Database, Bell, Cpu, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Disclaimer } from "@/components/common/Disclaimer";
import { Pill } from "@/components/common/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { API_BASE_URL, ENDPOINTS, ENVIRONMENT_LABEL, USE_MOCK_BACKEND } from "@/api/config";
import { useSession, PERMISSIONS } from "@/hooks/useSession";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & AWS Readiness — ClinicalFlow AI" },
      {
        name: "description",
        content:
          "Environment configuration, role permissions and the AWS service mapping this demo is designed to swap into.",
      },
      { property: "og:title", content: "Settings & AWS Readiness — ClinicalFlow AI" },
      {
        property: "og:description",
        content: "Mock service layer, REST contract and AWS integration plan for the clinical workflow assistant.",
      },
    ],
  }),
  component: SettingsPage,
});

const SERVICES = [
  {
    icon: Database,
    aws: "Amazon HealthLake",
    role: "FHIR patient records source",
    mock: "mockHealthLakeService",
  },
  { icon: Cpu, aws: "Amazon Bedrock", role: "Clinical summarisation LLM", mock: "mockBedrockService" },
  { icon: Database, aws: "Amazon DynamoDB", role: "Summaries, referrals, audit", mock: "mockDynamoDBService" },
  { icon: Bell, aws: "Amazon SNS / SES", role: "Referral notifications", mock: "mockSNSService" },
  { icon: ShieldCheck, aws: "Amazon Cognito", role: "Authentication & roles", mock: "SessionProvider" },
  { icon: Cloud, aws: "API Gateway + Lambda", role: "REST API surface", mock: "clinicalApi" },
] as const;

function SettingsPage() {
  const { user } = useSession();
  const perms = PERMISSIONS[user.role];

  return (
    <>
      <PageHeader
        title="Settings & AWS Readiness"
        description="How this demo maps onto the target AWS architecture, and what the current environment is running."
      />
      <Disclaimer />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Environment</CardTitle>
            <CardDescription>Runtime configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Mode" value={<Pill tone="warning">{ENVIRONMENT_LABEL}</Pill>} />
            <Row
              label="Backend"
              value={
                <Pill tone={USE_MOCK_BACKEND ? "info" : "success"}>
                  {USE_MOCK_BACKEND ? "Mock service layer" : "Live API Gateway"}
                </Pill>
              }
            />
            <Row label="API base URL" value={<code className="text-xs">{API_BASE_URL || "not set"}</code>} />
            <Separator />
            <Row label="Signed in as" value={user.name} />
            <Row label="Role" value={<Pill tone="info">{user.role}</Pill>} />
            <Separator />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Permissions</p>
            <ul className="space-y-1.5">
              {Object.entries(perms).map(([key, allowed]) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{key}</span>
                  <Pill tone={allowed ? "success" : "neutral"}>{allowed ? "Allowed" : "Denied"}</Pill>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">AWS service mapping</CardTitle>
            <CardDescription>
              Every mock implements a typed interface, so swapping in the real SDK client requires no UI changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SERVICES.map((s) => (
              <div
                key={s.aws}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-muted/60 px-3 py-2.5"
              >
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <s.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{s.aws}</p>
                  <p className="text-xs text-muted-foreground">{s.role}</p>
                </div>
                <code className="rounded bg-secondary px-2 py-1 text-xs">{s.mock}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">REST contract</CardTitle>
          <CardDescription>Routes the mock client mirrors 1:1 for a drop-in backend swap.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(ENDPOINTS).map(([key, value]) => (
            <code key={key} className="rounded-md bg-surface-muted px-3 py-2 text-xs">
              {typeof value === "function" ? value("{id}") : value}
            </code>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}