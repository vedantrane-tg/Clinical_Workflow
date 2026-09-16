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

const COUNTRY_CODES = [
  { code: "+91", label: "IN +91", digits: 10, pattern: /^[6-9]\d{9}$/, placeholder: "9876543210" },
  { code: "+1", label: "US +1", digits: 10, pattern: /^\d{10}$/, placeholder: "2025550123" },
  { code: "+44", label: "UK +44", digits: 10, pattern: /^\d{10}$/, placeholder: "7911123456" },
  { code: "+971", label: "AE +971", digits: 9, pattern: /^[5]\d{8}$/, placeholder: "501234567" },
  { code: "+65", label: "SG +65", digits: 8, pattern: /^[689]\d{7}$/, placeholder: "91234567" },
  { code: "+61", label: "AU +61", digits: 9, pattern: /^[4]\d{8}$/, placeholder: "412345678" },
  { code: "+977", label: "NP +977", digits: 10, pattern: /^[9]\d{9}$/, placeholder: "9841234567" },
  { code: "+94", label: "LK +94", digits: 9, pattern: /^[7]\d{8}$/, placeholder: "712345678" },
] as const;

type CountryCode = (typeof COUNTRY_CODES)[number]["code"];

function countryMeta(code: string) {
  return COUNTRY_CODES.find((c) => c.code === code) ?? COUNTRY_CODES[0];
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .optional()
    .or(z.literal(""));

const schema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name is required")
      .max(120, "Name must be at most 120 characters")
      .regex(/^[A-Za-z][A-Za-z .'-]*$/, "Use letters only (spaces, hyphens, apostrophes allowed)"),
    date_of_birth: z
      .string()
      .min(1, "Date of birth is required")
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid date")
      .refine((value) => {
        const dob = new Date(`${value}T00:00:00`);
        return !Number.isNaN(dob.getTime());
      }, "Select a valid date")
      .refine((value) => new Date(`${value}T00:00:00`) <= new Date(), "Date of birth cannot be in the future")
      .refine((value) => {
        const year = Number(value.slice(0, 4));
        return year >= 1900;
      }, "Year must be 1900 or later")
      .refine((value) => {
        const dob = new Date(`${value}T00:00:00`);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
        return age <= 120;
      }, "Date of birth is not realistic"),
    gender: z.enum(["Male", "Female", "Other"], { required_error: "Select a gender" }),
    phone_country_code: z.enum(
      COUNTRY_CODES.map((c) => c.code) as [CountryCode, ...CountryCode[]],
      { required_error: "Select a country code" },
    ),
    contact_phone: z
      .string()
      .trim()
      .min(1, "Phone is required")
      .regex(/^\d+$/, "Phone must contain digits only"),
    contact_email: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid email"),
    insurance_id: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => !value || /^[A-Za-z0-9][A-Za-z0-9\-_/]{2,62}$/.test(value),
        "Use 3–63 letters, numbers, -, _, or /",
      ),
    address: z
      .string()
      .trim()
      .min(5, "Address is required")
      .max(512, "Address must be at most 512 characters"),
    pincode: z
      .string()
      .trim()
      .min(1, "Pincode is required")
      .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
    condition_name: optionalText(120),
    condition_code: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => !value || /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/i.test(value),
        "Use a valid ICD-10 code (e.g. E11.9)",
      ),
    medication_name: optionalText(120),
    medication_dose: optionalText(64),
  })
  .superRefine((values, ctx) => {
    const meta = countryMeta(values.phone_country_code);
    if (!meta.pattern.test(values.contact_phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contact_phone"],
        message: `Enter a valid ${meta.digits}-digit number for ${meta.code}`,
      });
    }
    if (values.condition_code && !values.condition_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["condition_name"],
        message: "Enter a condition name when providing an ICD-10 code",
      });
    }
    if (values.medication_dose && !values.medication_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["medication_name"],
        message: "Enter a medication name when providing a dose",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

function RequiredMark() {
  return (
    <span className="ml-0.5 text-destructive" aria-hidden>
      *
    </span>
  );
}

function toE164(countryCode: string, nationalNumber: string) {
  return `${countryCode}${nationalNumber.replace(/\D/g, "")}`;
}

function NewPatientPage() {
  const { user, can } = useSession();
  const navigate = useNavigate();
  const createPatient = useCreatePatient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      name: "",
      date_of_birth: "",
      gender: "Female",
      phone_country_code: "+91",
      contact_phone: "",
      contact_email: "",
      insurance_id: "",
      address: "",
      pincode: "",
      condition_name: "",
      condition_code: "",
      medication_name: "",
      medication_dose: "",
    },
  });

  const canSubmit = form.formState.isValid && !createPatient.isPending;
  const selectedCountry = countryMeta(form.watch("phone_country_code"));

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
        contact_phone: toE164(values.phone_country_code, values.contact_phone),
        contact_email: values.contact_email?.trim() || null,
        insurance_id: values.insurance_id?.trim() || null,
        address: values.address.trim(),
        pincode: values.pincode.trim(),
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
              <p className="text-xs text-muted-foreground">
                Fields marked <span className="text-destructive">*</span> are required to register.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>
                      Full name
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Riya Patel" autoComplete="name" {...field} />
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
                    <FormLabel>
                      Date of birth
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input type="date" max={new Date().toISOString().slice(0, 10)} {...field} />
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
                    <FormLabel>
                      Gender
                      <RequiredMark />
                    </FormLabel>
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
                  <FormItem className="sm:col-span-2">
                    <FormLabel>
                      Phone
                      <RequiredMark />
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormField
                        control={form.control}
                        name="phone_country_code"
                        render={({ field: codeField }) => (
                          <FormItem className="w-[8.5rem] shrink-0 space-y-0">
                            <Select
                              onValueChange={(value) => {
                                codeField.onChange(value);
                                void form.trigger("contact_phone");
                              }}
                              value={codeField.value}
                            >
                              <FormControl>
                                <SelectTrigger aria-label="Country code">
                                  <SelectValue placeholder="Code" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {COUNTRY_CODES.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormControl>
                        <Input
                          type="tel"
                          inputMode="numeric"
                          maxLength={selectedCountry.digits}
                          placeholder={`e.g. ${selectedCountry.placeholder}`}
                          autoComplete="tel-national"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e.target.value.replace(/\D/g, ""));
                          }}
                        />
                      </FormControl>
                    </div>
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
                      <Input
                        type="email"
                        placeholder="e.g. patient@example.com"
                        autoComplete="email"
                        {...field}
                      />
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
                    <FormLabel>
                      Address
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="e.g. 12 MG Road, Andheri West, Mumbai"
                        autoComplete="street-address"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pincode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Pincode
                      <RequiredMark />
                    </FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="e.g. 400053"
                        autoComplete="postal-code"
                        {...field}
                      />
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
                      <Input placeholder="e.g. POL-482910" {...field} />
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
                      <Input placeholder="e.g. Type 2 Diabetes Mellitus" {...field} />
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
                      <Input placeholder="e.g. E11.9" {...field} />
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
                      <Input placeholder="e.g. Metformin" {...field} />
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
                      <Input placeholder="e.g. 500 mg" {...field} />
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
            <Button type="submit" disabled={!canSubmit}>
              {createPatient.isPending ? "Registering…" : "Register patient"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
