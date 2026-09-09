import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  LogOut,
  Send,
  Settings,
  Stethoscope,
  UserRound,
  Users,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard, exact: true },
  { label: "Patients", to: "/patients", icon: Users, exact: false },
  { label: "Workflow Monitor", to: "/workflows", icon: Activity, exact: false },
  { label: "Referrals", to: "/referrals", icon: Send, exact: false },
  { label: "Specialists", to: "/specialists", icon: Stethoscope, exact: false },
  { label: "Referral Rules", to: "/rules", icon: ClipboardList, exact: false },
  { label: "Audit Trail", to: "/audit", icon: FileClock, exact: false },
  { label: "Settings", to: "/settings", icon: Settings, exact: false },
] as const;

export function AppSidebar() {
  const { user, signOut } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Activity className="size-5" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-accent-foreground">ClinicalFlow AI</p>
          <p className="text-[11px] text-sidebar-foreground/70">Agentic Clinical Workflow</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
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
            {user.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{user.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{user.role}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="Log out"
            className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
        <p className="flex items-center gap-1.5 px-2 pt-1 text-[11px] text-sidebar-foreground/50">
          <UserRound className="size-3" aria-hidden />
          Cognito-ready session (mock)
        </p>
      </div>
    </aside>
  );
}