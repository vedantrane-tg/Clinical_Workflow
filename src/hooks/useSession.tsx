import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "@/types/clinical";

export interface SessionUser {
  name: string;
  email: string;
  role: Role;
  initials: string;
}

const USERS: Record<Role, SessionUser> = {
  Clinician: {
    name: "Dr. Neha Kapoor",
    email: "n.kapoor@clinicalflow.demo",
    role: "Clinician",
    initials: "NK",
  },
  "Care Coordinator": {
    name: "Sameer Joshi",
    email: "s.joshi@clinicalflow.demo",
    role: "Care Coordinator",
    initials: "SJ",
  },
};

/** Permission matrix — mirrors the Cognito group claims planned for production. */
export const PERMISSIONS = {
  Clinician: {
    runWorkflow: true,
    viewEhr: true,
    createReferral: true,
    overrideReferral: false,
    editRules: true,
  },
  "Care Coordinator": {
    runWorkflow: false,
    viewEhr: true,
    createReferral: true,
    overrideReferral: true,
    editRules: false,
  },
} as const satisfies Record<Role, Record<string, boolean>>;

export type Permission = keyof (typeof PERMISSIONS)["Clinician"];

interface SessionValue {
  user: SessionUser;
  signedIn: boolean;
  setRole: (role: Role) => void;
  signOut: () => void;
  signIn: () => void;
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

const STORAGE_KEY = "clinicalflow.session.role";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("Clinician");
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "Clinician" || stored === "Care Coordinator") setRoleState(stored);
  }, []);

  const setRole = useCallback((next: Role) => {
    setRoleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user: USERS[role],
      signedIn,
      setRole,
      signOut: () => setSignedIn(false),
      signIn: () => setSignedIn(true),
      can: (permission: Permission) => PERMISSIONS[role][permission],
    }),
    [role, signedIn, setRole],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}