import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Pill } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  patientQuery,
  specialistsQuery,
  useCreatePayment,
} from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";
import type { Payment } from "@/types/clinical";

export const Route = createFileRoute("/receptionist/checkout/$patientId")({
  head: ({ params }) => ({
    meta: [
      { title: `Checkout ${params.patientId} — ClinicalFlow AI` },
      { name: "description", content: "Process consultation payment after triage." },
    ],
  }),
  component: CheckoutPage,
});

const CONSULTATION_FEE = 500;
const METHODS = ["Cash", "Card", "UPI", "Insurance"] as const;

function CheckoutPage() {
  const { patientId } = Route.useParams();
  const { user, can } = useSession();
  const { data: patient, isLoading } = useQuery(patientQuery(patientId));
  const { data: specialists = [] } = useQuery(specialistsQuery());
  const createPayment = useCreatePayment();
  const [method, setMethod] = useState<(typeof METHODS)[number]>("UPI");
  const [receipt, setReceipt] = useState<Payment | null>(null);

  const doctorName = useMemo(() => {
    if (!patient?.assigned_doctor_id) return null;
    return specialists.find((s) => s.specialist_id === patient.assigned_doctor_id)?.name ?? null;
  }, [patient?.assigned_doctor_id, specialists]);

  if (!can("processPayment")) {
    return <Navigate to="/" />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <>
        <PageHeader title="Payment" description={`Patient ${patientId} not found.`} />
        <Button asChild variant="outline">
          <Link to="/patients">Back to patients</Link>
        </Button>
      </>
    );
  }

  async function processPayment() {
    try {
      const payment = await createPayment.mutateAsync({
        patient_id: patientId,
        amount: CONSULTATION_FEE,
        payment_type: "Consultation",
        payment_method: method,
        actor_name: user?.name ?? "Receptionist",
        actor_role: user?.role ?? "Receptionist",
      });
      setReceipt(payment);
      toast.success("Payment completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Payment"
        description={`${patient.name} · ${patient.patient_id}`}
        actions={
          <Button asChild variant="outline">
            <Link to="/receptionist/triage/$patientId" params={{ patientId }}>
              Back to triage
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Visit summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Complaint:</span>{" "}
              {patient.chief_complaint ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Assigned doctor:</span>{" "}
              {doctorName ?? patient.assigned_doctor_id ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Queue:</span>{" "}
              {patient.queue_status ?? "—"}
              {patient.queue_position != null ? ` (#${patient.queue_position})` : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Fee breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consultation</span>
              <span>₹{CONSULTATION_FEE.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>₹0.00</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
              <span>Total</span>
              <span>₹{CONSULTATION_FEE.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {!receipt ? (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Payment method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={method}
              onValueChange={(v) => setMethod(v as (typeof METHODS)[number])}
              className="grid gap-3 sm:grid-cols-2"
            >
              {METHODS.map((m) => (
                <label
                  key={m}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <RadioGroupItem value={m} id={`pay-${m}`} />
                  <span>{m}</span>
                </label>
              ))}
            </RadioGroup>

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={createPayment.isPending}
                onClick={() => void processPayment()}
              >
                {createPayment.isPending ? "Processing…" : "Process payment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card border-success/40">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <CheckCircle2 className="size-5 text-success" />
            <CardTitle className="text-base">Payment successful</CardTitle>
            <Pill tone="success" className="ml-auto">
              {receipt.status}
            </Pill>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Receipt:</span> {receipt.payment_id}
            </p>
            <p>
              <span className="text-muted-foreground">Amount:</span> ₹{receipt.amount}{" "}
              {receipt.currency} via {receipt.payment_method}
            </p>
            <p>
              <span className="text-muted-foreground">Transaction:</span>{" "}
              <span className="font-mono text-xs">{receipt.transaction_ref}</span>
            </p>
            <p className="pt-2 text-foreground">
              {doctorName
                ? `Patient has been added to ${doctorName}'s queue.`
                : "Patient is in the waiting queue."}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild>
                <Link to="/patients">Back to patients</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/">Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
