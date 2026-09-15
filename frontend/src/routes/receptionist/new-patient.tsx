import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreatePatient } from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/receptionist/new-patient")({
  head: () => ({
    meta: [
      { title: "New Patient — ClinicalFlow AI" },
      { name: "description", content: "Register a new patient at the reception desk." },
    ],
  }),
  component: NewPatientPage,
});

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  gender: z.enum(["Male", "Female", "Other"]),
  contact_phone: z.string().optional(),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  insurance_id: z.string().optional(),
  address: z.string().optional(),
  condition_name: z.string().optional(),
  condition_code: z.string().optional(),
  medication_name: z.string().optional(),
  medication_dose: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function NewPatientPage() {
  const { user, can } = useSession();
  const navigate = useNavigate();
  const createPatient = useCreatePatient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      date_of_birth: "",
      gender: "Female",
      contact_phone: "",
      contact_email: "",
      insurance_id: "",
      address: "",
      condition_name: "",
      condition_code: "",
      medication_name: "",
      medication_dose: "",
    },
  });

  if (user && !can("registerPatient")) {
    return <Navigate to="/" />;
  }

  async function onSubmit(values: FormValues) {
    const conditions =
      values.condition_name?.trim()
        ? [
            {
              name: values.condition_name.trim(),
              code: values.condition_code?.trim() || "UNSPEC",
              codeSystem: "ICD-10",
              status: "Active",
              onsetDate: values.date_of_birth,
            },
          ]
        : [];

    const medications =
      values.medication_name?.trim()
        ? [
            {
              name: values.medication_name.trim(),
              dose: values.medication_dose?.trim() || "—",
              frequency: "As directed",
              status: "Active",
              startDate: values.date_of_birth,
            },
          ]
        : [];

    try {
      const patient = await createPatient.mutateAsync({
        name: values.name.trim(),
        date_of_birth: values.date_of_birth,
        gender: values.gender,
        contact_phone: values.contact_phone?.trim() || null,
        contact_email: values.contact_email?.trim() || null,
        insurance_id: values.insurance_id?.trim() || null,
        address: values.address?.trim() || null,
        conditions,
        medications,
      });
      toast.success(`Registered ${patient.patient_id}`);
      void navigate({
        to: "/receptionist/triage/$patientId",
        params: { patientId: patient.patient_id },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register patient");
    }
  }

  return (
    <>
      <PageHeader
        title="New Patient"
        description="Register a walk-in patient, then continue to triage."
        actions={
          <Button asChild variant="outline">
            <Link to="/patients">Patient list</Link>
          </Button>
        }
      />

      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit((v) => void onSubmit(v))}>
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Personal info</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Riya Patel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="patient@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Street, city" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Insurance</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="insurance_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Insurance ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional policy ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Medical history (optional)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="condition_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <FormControl>
                      <Input placeholder="Type 2 Diabetes Mellitus" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="condition_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ICD-10 code</FormLabel>
                    <FormControl>
                      <Input placeholder="E11.9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="medication_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Medication</FormLabel>
                    <FormControl>
                      <Input placeholder="Metformin" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="medication_dose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dose</FormLabel>
                    <FormControl>
                      <Input placeholder="500 mg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/patients">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createPatient.isPending}>
              {createPatient.isPending ? "Registering…" : "Register patient"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
