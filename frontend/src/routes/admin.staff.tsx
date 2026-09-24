import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { QueryError } from "@/components/common/QueryError";
import { Pill } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { staffQuery, useCreateStaff, useUpdateStaff } from "@/hooks/useClinicalQueries";
import type { StaffUser } from "@/types/clinical";

export const Route = createFileRoute("/admin/staff")({
  head: () => ({
    meta: [
      { title: "Staff — ClinicalFlow AI" },
      { name: "description", content: "Admin management of receptionists and doctors." },
    ],
  }),
  component: StaffPage,
});

type StaffRole = "Receptionist" | "Doctor";

function StaffPage() {
  const staffQ = useQuery(staffQuery());
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "Receptionist" as StaffRole,
    specialty: "",
    is_active: true,
  });

  function openCreate() {
    setForm({
      full_name: "",
      email: "",
      password: "",
      role: "Receptionist",
      specialty: "",
      is_active: true,
    });
    setCreateOpen(true);
  }

  function openEdit(user: StaffUser) {
    setForm({
      full_name: user.full_name,
      email: user.email,
      password: "",
      role: user.role,
      specialty: user.specialty ?? "",
      is_active: user.is_active,
    });
    setEditing(user);
  }

  async function submitCreate() {
    if (form.role === "Doctor" && !form.specialty.trim()) {
      toast.error("Specialty is required for a doctor");
      return;
    }
    try {
      await createStaff.mutateAsync({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        specialty: form.role === "Doctor" ? form.specialty.trim() : null,
      });
      toast.success("Staff account created");
      setCreateOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create staff");
    }
  }

  async function submitEdit() {
    if (!editing) return;
    if (form.role === "Doctor" && !form.specialty.trim()) {
      toast.error("Specialty is required for a doctor");
      return;
    }
    try {
      await updateStaff.mutateAsync({
        id: editing.user_id,
        patch: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          role: form.role,
          specialty: form.role === "Doctor" ? form.specialty.trim() : null,
          is_active: form.is_active,
          ...(form.password.trim() ? { password: form.password } : {}),
        },
      });
      toast.success("Staff details updated");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update staff");
    }
  }

  const staffForm = (
    <div className="grid gap-3 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="staff-name">Full name</Label>
        <Input
          id="staff-name"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-email">Email</Label>
        <Input
          id="staff-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-password">{editing ? "New password (optional)" : "Password"}</Label>
        <Input
          id="staff-password"
          type="password"
          minLength={editing ? undefined : 6}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required={!editing}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select
          value={form.role}
          onValueChange={(v) => setForm((f) => ({ ...f, role: v as StaffRole }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Receptionist">Receptionist</SelectItem>
            <SelectItem value="Doctor">Doctor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {form.role === "Doctor" ? (
        <div className="space-y-1.5">
          <Label htmlFor="staff-specialty">Specialty</Label>
          <Input
            id="staff-specialty"
            value={form.specialty}
            onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
            placeholder="General Medicine"
          />
        </div>
      ) : null}
      {editing ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          Active (can sign in)
        </label>
      ) : null}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Staff"
        description="Create and update receptionist and doctor accounts."
        actions={
          <Button type="button" onClick={openCreate}>
            <UserPlus className="mr-1.5 size-4" />
            Add staff
          </Button>
        }
      />

      {staffQ.isError ? (
        <QueryError message="Could not load staff." onRetry={() => void staffQ.refetch()} />
      ) : null}

      <Card className="shadow-card">
        <CardContent className="pt-6">
          {staffQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(staffQ.data ?? []).map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.specialty ?? "—"}</TableCell>
                    <TableCell>
                      <Pill tone={user.is_active ? "success" : "danger"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Pill>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(user)}>
                        <Pencil className="mr-1 size-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff</DialogTitle>
          </DialogHeader>
          {staffForm}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={createStaff.isPending} onClick={() => void submitCreate()}>
              {createStaff.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit staff</DialogTitle>
          </DialogHeader>
          {staffForm}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={updateStaff.isPending} onClick={() => void submitEdit()}>
              {updateStaff.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
