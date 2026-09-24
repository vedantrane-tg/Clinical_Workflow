import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — ClinicalFlow AI" },
      { name: "description", content: "Create a ClinicalFlow AI account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { signup } = useSession();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"Receptionist" | "Doctor">("Receptionist");
  const [specialty, setSpecialty] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (role === "Doctor" && !specialty.trim()) {
      toast.error("Specialty is required for Doctor accounts");
      return;
    }
    setBusy(true);
    try {
      await signup({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        specialty: role === "Doctor" ? specialty.trim() : null,
      });
      toast.success("Account created! Please login.");
      void navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-card">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">ClinicalFlow AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create your account</p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Role</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="role"
                  checked={role === "Receptionist"}
                  onChange={() => setRole("Receptionist")}
                />
                Receptionist
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="role"
                  checked={role === "Doctor"}
                  onChange={() => setRole("Doctor")}
                />
                Doctor
              </label>
            </div>
          </div>

          {role === "Doctor" ? (
            <div className="space-y-2">
              <Label htmlFor="specialty">Specialty</Label>
              <Input
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. General Medicine"
                required
              />
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
