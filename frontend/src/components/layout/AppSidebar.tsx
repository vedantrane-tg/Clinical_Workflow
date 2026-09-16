import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ClipboardPlus,
  FileClock,
  LayoutDashboard,
  LogOut,
  Send,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/clinical";

type NavItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const RECEPTIONIST_NAV: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, exact: true },
  { label: "Patients", to: "/patients", icon: Users },
  { label: "New Patient", to: "/receptionist/new-patient", icon: ClipboardPlus },
  { label: "Audit Trail", to: "/audit", icon: FileClock },
];

const DOCTOR_NAV: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, exact: true },
  { label: "Patients", to: "/patients", icon: Users },
  { label: "Workflow Monitor", to: "/workflows", icon: Activity },
  { label: "Referrals", to: "/referrals", icon: Send },
  { label: "Specialists", to: "/specialists", icon: Stethoscope },
  { label: "Audit Trail", to: "/audit", icon: FileClock },
];

function navForRole(role: Role | undefined): NavItem[] {
  if (role === "Receptionist") return RECEPTIONIST_NAV;
  if (role === "Doctor") return DOCTOR_NAV;
  return RECEPTIONIST_NAV;
}

export function AppSidebar() {
  const { user, logout } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useMemo(() => navForRole(user?.role), [user?.role]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
        <img
          src="/teleglobals_logo.jpg"
          alt="teleGlobal"
          className="size-9 shrink-0 rounded-full object-cover ring-1 ring-sidebar-border"
        />
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-sidebar-accent-foreground">ClinicalFlow AI</p>
          <p className="truncate text-[11px] text-sidebar-foreground/70">
            {user?.role === "Doctor" ? "Doctor workspace" : "Reception desk"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {user?.initials ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
              {user?.name ?? "Signed out"}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70">{user?.role ?? "—"}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
        <p className="flex items-center gap-1.5 px-2 pt-1 text-[11px] text-sidebar-foreground/50">
          <UserRound className="size-3" aria-hidden />
          JWT session (backend auth)
        </p>
      </div>
    </aside>
  );
}
