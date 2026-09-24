import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clinicalApi, getAuthToken, setAuthToken } from "@/api/clinicalApi";
import type { Role } from "@/types/clinical";

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  role: Role;
  specialty: string | null;
  initials: string;
}

export const PERMISSIONS = {
  Admin: {
    manageStaff: true,
    editPatient: true,
    registerPatient: false,
    runTriage: false,
    processPayment: false,
    runWorkflow: false,
    recordConsultation: false,
    signEncounter: false,
    viewEhr: true,
    createReferral: false,
    overrideReferral: false,
    editRules: false,
    viewClinic: true,
  },
  Receptionist: {
    manageStaff: false,
    editPatient: false,
    registerPatient: true,
    runTriage: true,
    processPayment: true,
    runWorkflow: false,
    recordConsultation: false,
    signEncounter: false,
    viewEhr: true,
    createReferral: false,
    overrideReferral: false,
    editRules: false,
    viewClinic: false,
  },
  Doctor: {
    manageStaff: false,
    editPatient: false,
    registerPatient: false,
    runTriage: false,
    processPayment: false,
    runWorkflow: true,
    recordConsultation: true,
    signEncounter: true,
    viewEhr: true,
    createReferral: true,
    overrideReferral: false,
    editRules: true,
    viewClinic: false,
  },
} as const satisfies Record<Role, Record<string, boolean>>;

export type Permission =
  | keyof (typeof PERMISSIONS)["Receptionist"]
  | keyof (typeof PERMISSIONS)["Doctor"];

interface SessionValue {
  user: SessionUser | null;
  signedIn: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    full_name: string;
    email: string;
    password: string;
    role: "Receptionist" | "Doctor";
    specialty?: string | null;
  }) => Promise<void>;
  logout: () => void;
  can: (permission: Permission) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

function toSessionUser(u: {
  user_id: string;
  full_name: string;
  email: string;
  role: Role;
  specialty: string | null;
}): SessionUser {
  const parts = u.full_name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
  return {
    userId: u.user_id,
    name: u.full_name,
    email: u.email,
    role: u.role,
    specialty: u.specialty,
    initials,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    clinicalApi
      .me()
      .then((u) => setUser(toSessionUser(u)))
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await clinicalApi.login(email, password);
    setAuthToken(res.access_token);
    setUser(toSessionUser(res.user));
  }, []);

  const signup = useCallback(
    async (input: {
      full_name: string;
      email: string;
      password: string;
      role: "Receptionist" | "Doctor";
      specialty?: string | null;
    }) => {
      await clinicalApi.signup(input);
    },
    [],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      signedIn: Boolean(user),
      loading,
      login,
      signup,
      logout,
      can: (permission) => {
        if (!user) return false;
        const matrix = PERMISSIONS[user.role] as Record<string, boolean>;
        return Boolean(matrix[permission]);
      },
    }),
    [user, loading, login, signup, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
