import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { QueryError } from "@/components/common/QueryError";
import { Pill } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  appointmentsQuery,
  clinicDoctorsQuery,
  patientsQuery,
  useCreateAppointment,
  useCreatePatient,
  useUpdateAppointment,
} from "@/hooks/useClinicalQueries";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import {
  PHONE_COUNTRY_CODES,
  phoneCountryMeta,
  toE164,
  validateNationalPhone,
  type PhoneCountryCode,
} from "@/lib/phone";
import type { Appointment, AppointmentStatus } from "@/types/clinical";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — ClinicalFlow AI" },
      {
        name: "description",
        content: "Clinic appointment calendar with booking, check-in, and day agenda.",
      },
    ],
  }),
  component: CalendarPage,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VISIT_TYPES = ["Consultation", "Follow-up", "New Visit", "Procedure"] as const;
const STATUS_FILTERS = ["all", "Scheduled", "Checked In", "Completed", "Cancelled", "No Show"] as const;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isPastDay(d: Date, today: Date = new Date()) {
  return startOfDay(d).getTime() < startOfDay(today).getTime();
}

function toLocalInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/** Earliest bookable slot: now, rounded up to the next minute. */
function earliestBookableLocalInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  return toLocalInputValue(d);
}

function parseApptDate(iso: string) {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}`);
}

function formatTime(iso: string) {
  return parseApptDate(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" | "info" {
  if (status === "Completed" || status === "Checked In") return "success";
  if (status === "Scheduled") return "info";
  if (status === "Cancelled" || status === "No Show") return "danger";
  return "neutral";
}

function monthCells(viewMonth: Date) {
  const first = startOfMonth(viewMonth);
  const startPad = first.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function CalendarPage() {
  const { user } = useSession();
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [bookOpen, setBookOpen] = useState(false);

  const range = useMemo(() => {
    const from = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const to = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [viewMonth]);

  const doctorsQ = useQuery(clinicDoctorsQuery());
  const patientsQ = useQuery(patientsQuery());
  const apptsQ = useQuery(
    appointmentsQuery({
      from: range.from,
      to: range.to,
      ...(doctorFilter !== "all" ? { doctor_id: doctorFilter } : {}),
    }),
  );

  const createAppt = useCreateAppointment();
  const createPatient = useCreatePatient();
  const updateAppt = useUpdateAppointment();

  const appointments = apptsQ.data ?? [];

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      if (statusFilter !== "all" && a.status !== statusFilter) continue;
      const key = dayKey(parseApptDate(a.starts_at));
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((x, y) => +parseApptDate(x.starts_at) - +parseApptDate(y.starts_at));
    }
    return map;
  }, [appointments, statusFilter]);

  const dayAppts = byDay.get(dayKey(selectedDay)) ?? [];
  const todayAppts = (byDay.get(dayKey(today)) ?? []).filter(
    (a) => a.status === "Scheduled" || a.status === "Checked In",
  );

  const cells = useMemo(() => monthCells(viewMonth), [viewMonth]);

  async function setStatus(appt: Appointment, status: AppointmentStatus) {
    try {
      await updateAppt.mutateAsync({
        id: appt.appointment_id,
        patch: {
          status,
          actor_name: user?.name ?? "Staff",
          actor_role: user?.role ?? "Receptionist",
        },
      });
      toast.success(`${appt.patient_name} → ${status}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  const [patientMode, setPatientMode] = useState<"existing" | "new">("existing");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [form, setForm] = useState({
    patient_id: "",
    doctor_id: "",
    starts_at: toLocalInputValue(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 10, 0)),
    duration_minutes: "30",
    visit_type: "Consultation",
    reason: "",
    notes: "",
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "Male",
    phone_country_code: "+91" as PhoneCountryCode,
    phone: "",
    address: "Clinic front desk registration",
    pincode: "411001",
  });

  const phoneMeta = phoneCountryMeta(form.phone_country_code);

  function openBook(day?: Date) {
    const base = day ?? selectedDay;
    if (isPastDay(base, today)) {
      toast.error("Cannot book on a past date. Choose today or a future date.");
      return;
    }
    const doctors = doctorsQ.data ?? [];
    const defaultSlot = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0);
    const earliest = new Date();
    earliest.setSeconds(0, 0);
    earliest.setMinutes(earliest.getMinutes() + 1);
    const starts =
      sameDay(base, today) && defaultSlot.getTime() < earliest.getTime()
        ? earliest
        : defaultSlot;

    setPatientMode("existing");
    setPhoneError(null);
    setForm({
      patient_id: patientsQ.data?.[0]?.patient_id ?? "",
      doctor_id:
        user?.role === "Doctor"
          ? (user.userId ?? doctors[0]?.doctor_id ?? "")
          : (doctors[0]?.doctor_id ?? ""),
      starts_at: toLocalInputValue(starts),
      duration_minutes: "30",
      visit_type: "Consultation",
      reason: "",
      notes: "",
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: "Male",
      phone_country_code: "+91",
      phone: "",
      address: "Clinic front desk registration",
      pincode: "411001",
    });
    setBookOpen(true);
  }

  function onPhoneChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, phoneMeta.digits);
    setForm((f) => ({ ...f, phone: digits }));
    if (!digits) {
      setPhoneError(null);
      return;
    }
    setPhoneError(validateNationalPhone(form.phone_country_code, digits));
  }

  async function submitBook() {
    if (!form.doctor_id || !form.starts_at) {
      toast.error("Doctor and time are required");
      return;
    }

    const startsAt = new Date(form.starts_at);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error("Invalid date and time");
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      toast.error("Cannot book in the past. Choose today or a future date and time.");
      return;
    }

    try {
      let patientId = form.patient_id;

      if (patientMode === "new") {
        if (!form.first_name.trim() || !form.last_name.trim() || !form.date_of_birth) {
          toast.error("New patient needs name and date of birth");
          return;
        }
        const phoneErr = validateNationalPhone(form.phone_country_code, form.phone);
        if (phoneErr) {
          setPhoneError(phoneErr);
          toast.error(phoneErr);
          return;
        }
        const created = await createPatient.mutateAsync({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          date_of_birth: form.date_of_birth,
          gender: form.gender,
          contact_phone: toE164(form.phone_country_code, form.phone),
          address: form.address.trim() || "Clinic front desk registration",
          pincode: form.pincode.trim() || "411001",
        });
        patientId = created.patient_id;
      }

      if (!patientId) {
        toast.error("Select an existing patient or register a new one");
        return;
      }

      await createAppt.mutateAsync({
        patient_id: patientId,
        doctor_id: form.doctor_id,
        starts_at: new Date(form.starts_at).toISOString(),
        duration_minutes: Number(form.duration_minutes) || 30,
        visit_type: form.visit_type,
        reason: form.reason || null,
        notes: form.notes || null,
        actor_name: user?.name ?? "Staff",
        actor_role: user?.role ?? "Receptionist",
      });
      toast.success(
        patientMode === "new"
          ? `Patient registered and appointment booked (${patientId})`
          : "Appointment booked",
      );
      setBookOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    }
  }

  const bookingBusy = createAppt.isPending || createPatient.isPending;
  const loading = apptsQ.isLoading || doctorsQ.isLoading;
  const error = apptsQ.isError;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Book visits, see the month at a glance, and check patients in from the agenda."
        actions={
          <Button type="button" onClick={() => openBook()}>
            <Plus className="mr-1.5 size-4" />
            Book appointment
          </Button>
        }
      />

      {error ? (
        <QueryError
          message="Could not load calendar. Check that the backend is running, then retry."
          onRetry={() => void apptsQ.refetch()}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0 pb-3">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous month"
                onClick={() => setViewMonth((m) => addMonths(m, -1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next month"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
              <CardTitle className="ml-2 text-base">
                {viewMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </CardTitle>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setViewMonth(startOfMonth(today));
                  setSelectedDay(today);
                }}
              >
                Today
              </Button>
              <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger className="w-[180px]" aria-label="Filter by doctor">
                  <SelectValue placeholder="Doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All doctors</SelectItem>
                  {(doctorsQ.data ?? []).map((d) => (
                    <SelectItem key={d.doctor_id} value={d.doctor_id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as (typeof STATUS_FILTERS)[number])}
              >
                <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "All statuses" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[360px] w-full" />
            ) : (
              <>
                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((day, idx) => {
                    if (!day) {
                      return <div key={`e-${idx}`} className="min-h-[88px] rounded-md bg-muted/30" />;
                    }
                    const key = dayKey(day);
                    const list = byDay.get(key) ?? [];
                    const isSelected = sameDay(day, selectedDay);
                    const isToday = sameDay(day, today);
                    const past = isPastDay(day, today);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        onDoubleClick={() => {
                          if (past) {
                            toast.error("Cannot book on a past date. Choose today or a future date.");
                            return;
                          }
                          openBook(day);
                        }}
                        className={cn(
                          "min-h-[88px] rounded-md border p-1.5 text-left transition-colors",
                          past && "opacity-45",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-muted/40",
                          isToday && !isSelected && "border-primary/50",
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded-full text-xs",
                              isToday && "bg-primary font-semibold text-primary-foreground",
                            )}
                          >
                            {day.getDate()}
                          </span>
                          {list.length > 0 ? (
                            <span className="text-[10px] text-muted-foreground">{list.length}</span>
                          ) : null}
                        </div>
                        <div className="space-y-0.5">
                          {list.slice(0, 2).map((a) => (
                            <div
                              key={a.appointment_id}
                              className="truncate rounded bg-sidebar/10 px-1 py-0.5 text-[10px] leading-tight"
                              title={`${formatTime(a.starts_at)} ${a.patient_name}`}
                            >
                              {formatTime(a.starts_at)} {a.patient_name}
                            </div>
                          ))}
                          {list.length > 2 ? (
                            <p className="text-[10px] text-muted-foreground">+{list.length - 2} more</p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4 text-primary" />
                {selectedDay.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : dayAppts.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  title="No appointments"
                  description="Book a visit for this day or pick another date."
                />
              ) : (
                dayAppts.map((a) => (
                  <div key={a.appointment_id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{a.patient_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(a.starts_at)} · {a.duration_minutes} min · {a.visit_type}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Stethoscope className="size-3" />
                          {a.doctor_name}
                        </p>
                        {a.reason ? <p className="mt-1 text-xs">{a.reason}</p> : null}
                      </div>
                      <Pill tone={statusTone(a.status)}>{a.status}</Pill>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.status === "Scheduled" ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            asChild
                          >
                            <Link
                              to="/receptionist/triage/$patientId"
                              params={{ patientId: a.patient_id }}
                              onClick={() => {
                                void setStatus(a, "Checked In");
                              }}
                            >
                              Check in
                            </Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void setStatus(a, "Cancelled")}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void setStatus(a, "No Show")}
                          >
                            No show
                          </Button>
                        </>
                      ) : null}
                      {a.status === "Checked In" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void setStatus(a, "Completed")}
                        >
                          Mark completed
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <Link to="/patients/$patientId" params={{ patientId: a.patient_id }}>
                          Patient
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Today&apos;s agenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {todayAppts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active visits left today.</p>
              ) : (
                todayAppts.map((a) => (
                  <div
                    key={`today-${a.appointment_id}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                  >
                    <span>
                      {formatTime(a.starts_at)} · {a.patient_name}
                    </span>
                    <Pill tone={statusTone(a.status)}>{a.status}</Pill>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={bookOpen} onOpenChange={setBookOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Book appointment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label>Patient</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={patientMode === "existing" ? "default" : "outline"}
                  onClick={() => setPatientMode("existing")}
                >
                  Existing patient
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={patientMode === "new" ? "default" : "outline"}
                  onClick={() => setPatientMode("new")}
                >
                  New patient
                </Button>
              </div>
            </div>

            {patientMode === "existing" ? (
              <div className="space-y-1.5">
                <Label htmlFor="appt-patient">Select patient</Label>
                <Select
                  value={form.patient_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, patient_id: v }))}
                >
                  <SelectTrigger id="appt-patient">
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {(patientsQ.data ?? []).map((p) => (
                      <SelectItem key={p.patient_id} value={p.patient_id}>
                        {p.name} ({p.patient_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Registers the patient, then books the slot in one step.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="np-first">First name</Label>
                    <Input
                      id="np-first"
                      value={form.first_name}
                      onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                      placeholder="Riya"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="np-last">Last name</Label>
                    <Input
                      id="np-last"
                      value={form.last_name}
                      onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                      placeholder="Sharma"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="np-dob">Date of birth</Label>
                    <Input
                      id="np-dob"
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="np-gender">Gender</Label>
                    <Select
                      value={form.gender}
                      onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}
                    >
                      <SelectTrigger id="np-gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-phone">Phone</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.phone_country_code}
                      onValueChange={(v) => {
                        const code = v as PhoneCountryCode;
                        const meta = phoneCountryMeta(code);
                        const nextPhone = form.phone.slice(0, meta.digits);
                        setForm((f) => ({
                          ...f,
                          phone_country_code: code,
                          phone: nextPhone,
                        }));
                        setPhoneError(
                          nextPhone ? validateNationalPhone(code, nextPhone) : null,
                        );
                      }}
                    >
                      <SelectTrigger className="w-[118px]" aria-label="Country code">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_COUNTRY_CODES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="np-phone"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={phoneMeta.digits}
                      value={form.phone}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      onBlur={() => {
                        if (form.phone || patientMode === "new") {
                          setPhoneError(
                            validateNationalPhone(form.phone_country_code, form.phone),
                          );
                        }
                      }}
                      placeholder={phoneMeta.placeholder}
                      aria-invalid={Boolean(phoneError)}
                      className={cn(phoneError && "border-destructive focus-visible:ring-destructive")}
                    />
                  </div>
                  {phoneError ? (
                    <p className="text-xs text-destructive">{phoneError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {phoneMeta.digits}-digit mobile for {phoneMeta.label}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="np-address">Address</Label>
                    <Input
                      id="np-address"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="np-pin">Pincode</Label>
                    <Input
                      id="np-pin"
                      value={form.pincode}
                      onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                      placeholder="411001"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Need full registration (guardian, insurance)? Use{" "}
                  <Link to="/receptionist/new-patient" className="text-primary underline">
                    New Patient
                  </Link>{" "}
                  first, then book as existing.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="appt-doctor">Doctor</Label>
              <Select
                value={form.doctor_id}
                onValueChange={(v) => setForm((f) => ({ ...f, doctor_id: v }))}
              >
                <SelectTrigger id="appt-doctor">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {(doctorsQ.data ?? []).map((d) => (
                    <SelectItem key={d.doctor_id} value={d.doctor_id}>
                      {d.name}
                      {d.specialty ? ` · ${d.specialty}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="appt-when">Date & time</Label>
                <Input
                  id="appt-when"
                  type="datetime-local"
                  min={earliestBookableLocalInput()}
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appt-dur">Duration (min)</Label>
                <Input
                  id="appt-dur"
                  type="number"
                  min={10}
                  max={180}
                  value={form.duration_minutes}
                  onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-type">Visit type</Label>
              <Select
                value={form.visit_type}
                onValueChange={(v) => setForm((f) => ({ ...f, visit_type: v }))}
              >
                <SelectTrigger id="appt-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-reason">Reason</Label>
              <Input
                id="appt-reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Chief complaint / purpose"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-notes">Notes</Label>
              <Textarea
                id="appt-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Optional desk notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBookOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={bookingBusy || (patientMode === "new" && Boolean(phoneError))}
              onClick={() => void submitBook()}
            >
              {bookingBusy
                ? patientMode === "new"
                  ? "Registering…"
                  : "Booking…"
                : patientMode === "new"
                  ? "Register & book"
                  : "Book"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
