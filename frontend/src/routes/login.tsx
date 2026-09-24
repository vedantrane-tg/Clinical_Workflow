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
      { title: "Login — ClinicalFlow" },
      { name: "description", content: "Sign in to ClinicalFlow." },
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

  async function quickLogin(kind: "receptionist" | "doctor" | "admin") {
    setBusy(true);
    try {
      if (kind === "receptionist") {
        await login("ananya@clinicalflow.demo", "receptionist123");
      } else if (kind === "doctor") {
        await login("neha@clinicalflow.demo", "doctor123");
      } else {
        await login("admin@clinicalflow.demo", "admin123");
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
      <div className="w-full max-w-md rounded-xl border border-border bg-[#102844] p-6 shadow-card">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/tele-logo.webp"
            alt="teleGlobal"
            className="mb-4 h-11 w-auto max-w-[220px] object-contain"
          />
          <h1 className="text-xl font-semibold tracking-tight text-white">ClinicalFlow</h1>
        </div>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-slate-200">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-white/15 bg-[#0b1f3a] text-white placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-200">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="border-white/15 bg-[#0b1f3a] text-white placeholder:text-slate-400"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Login"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/15" />
          <span className="text-xs text-slate-400">Demo</span>
          <div className="h-px flex-1 bg-white/15" />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void quickLogin("receptionist")}
            className="border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white"
          >
            Receptionist
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void quickLogin("doctor")}
            className="border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white"
          >
            Doctor
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void quickLogin("admin")}
            className="border-white/20 bg-transparent text-slate-100 hover:bg-white/10 hover:text-white"
          >
            Admin
          </Button>
        </div>

        <p className="mt-5 text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="font-medium text-sky-300 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
