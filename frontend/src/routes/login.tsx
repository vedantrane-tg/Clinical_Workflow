import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — ClinicalFlow AI" },
      { name: "description", content: "Sign in to ClinicalFlow AI." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast.success("Signed in");
      void navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  async function quickLogin(kind: "receptionist" | "doctor") {
    setBusy(true);
    try {
      if (kind === "receptionist") {
        await login("ananya@clinicalflow.demo", "receptionist123");
      } else {
        await login("neha@clinicalflow.demo", "doctor123");
      }
      toast.success("Signed in");
      void navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-card">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">ClinicalFlow AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agentic Clinical Workflow</p>
        </div>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Login"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">Demo</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void quickLogin("receptionist")}
          >
            Receptionist
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void quickLogin("doctor")}
          >
            Doctor
          </Button>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
