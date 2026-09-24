import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryError } from "@/components/common/QueryError";
import { AcuityBadge, Pill, QueueStatusBadge } from "@/components/common/StatusBadge";
import { AudioRecorder } from "@/components/consultation/AudioRecorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  latestTriageQuery,
  patientQuery,
  useUploadAndScribe,
} from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";
import type { Consultation } from "@/types/clinical";

export const Route = createFileRoute("/doctor/consult/$patientId")({
  head: ({ params }) => ({
    meta: [
      { title: `Consult ${params.patientId} — ClinicalFlow AI` },
      { name: "description", content: "Doctor consultation room with ambient scribe." },
    ],
  }),
  component: ConsultationRoomPage,
});

function ConsultationRoomPage() {
  const { patientId } = Route.useParams();
  const { can } = useSession();
  const navigate = useNavigate();
  const { data: patient, isLoading, isError, refetch } = useQuery(patientQuery(patientId));
  const { data: triage } = useQuery(latestTriageQuery(patientId));
  const uploadAndScribe = useUploadAndScribe(patientId);
  const [pendingFile, setPendingFile] = useState<{ blob: Blob; name: string } | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const soapRef = useRef<HTMLDivElement | null>(null);

  if (!can("recordConsultation") && !can("viewClinic")) {
    return <Navigate to="/" />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <QueryError
        message="Couldn’t load this consultation."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  async function runScribe() {
    if (!pendingFile) {
      toast.error("Record or upload audio first");
      return;
    }
    try {
      const result = await uploadAndScribe.mutateAsync(pendingFile);
      setConsultation(result);
      toast.success("SOAP note generated");
      window.setTimeout(() => {
        soapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scribe failed");
    }
  }

  const soap = consultation?.soap_note;

  return (
    <>
      <PageHeader
        title="Consultation room"
        description={`${patient.name} · ${patient.patient_id} · ${patient.age}${patient.gender?.[0] ?? ""}`}
        actions={
          <Button asChild variant="outline">
            <Link to="/">Back to queue</Link>
          </Button>
        }
      />

      <Card className="shadow-card">
        <CardContent className="flex flex-wrap gap-3 pt-6 text-sm">
          <Pill tone="info">{patient.chief_complaint ?? "No chief complaint"}</Pill>
          <QueueStatusBadge status={patient.queue_status ?? "—"} />
          {triage ? <AcuityBadge level={triage.acuity_level} /> : null}
          {triage?.recommended_specialty ? (
            <Pill tone="success">{triage.recommended_specialty}</Pill>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Pre-visit brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {triage ? (
              <>
                <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-3">
                  {triage.pre_visit_brief}
                </pre>
                {triage.brief_sections?.length ? (
                  <div className="space-y-2">
                    {triage.brief_sections.map((s) => (
                      <div key={s.heading} className="rounded-md border border-border p-3">
                        <p className="font-medium">{s.heading}</p>
                        <p className="mt-1 text-muted-foreground">{s.body}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">
                No triage brief yet. Reception should run check-in first.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Audio capture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AudioRecorder
              disabled={!can("recordConsultation") || uploadAndScribe.isPending}
              onReady={(blob, name) => {
                setPendingFile({ blob, name });
                toast.message(`Audio ready: ${name}`);
              }}
            />
            {pendingFile ? (
              <p className="text-xs text-muted-foreground">
                Selected: {pendingFile.name} ({Math.round(pendingFile.blob.size / 1024)} KB)
              </p>
            ) : null}
            <Button
              type="button"
              disabled={!can("recordConsultation") || !pendingFile || uploadAndScribe.isPending}
              onClick={() => void runScribe()}
            >
              {uploadAndScribe.isPending ? "Transcribing & scribing…" : "Stop & generate SOAP"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Upload or stop recording, then generate. This can take 10–30 seconds.
            </p>
          </CardContent>
        </Card>
      </div>

      {consultation ? (
        <div ref={soapRef}>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">SOAP note</CardTitle>
            <Pill tone="success">{consultation.status}</Pill>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <SoapBlock title="Subjective" body={soap?.subjective} />
              <SoapBlock title="Objective" body={soap?.objective} />
              <SoapBlock title="Assessment" body={soap?.assessment} />
              <SoapBlock title="Plan" body={soap?.plan} />
            </div>

            {consultation.key_points?.length ? (
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">Key findings</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {consultation.key_points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {consultation.transcript ? (
              <details className="rounded-md border border-border p-3 text-sm" open>
                <summary className="cursor-pointer font-medium">Transcript</summary>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                  {consultation.transcript}
                </p>
              </details>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() =>
                  void navigate({
                    to: "/doctor/review/$consultationId",
                    params: { consultationId: consultation.consultation_id },
                  })
                }
              >
                Proceed to clinical orders
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      ) : null}
    </>
  );
}

function SoapBlock({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{body?.trim() || "—"}</p>
    </div>
  );
}
