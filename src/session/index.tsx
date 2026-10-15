import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import type { AuthResponse, CompanyRole, User } from "@/api/types";
import { api, configureClient } from "@/api/client";
import { getLocale } from "@/i18n";
import { authenticateBiometric, biometricAvailable } from "./biometric";
import { clearSession, readSession, roleIn, writeSession } from "./store";

export type SessionStatus = "loading" | "signedOut" | "locked" | "signedIn";

interface SessionValue {
  status: SessionStatus;
  user: User | null;
  token: string | null;
  companyId: number | null;
  role: CompanyRole | null;
  biometricEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setCompany: (companyId: number) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  unlock: () => Promise<boolean>;
}

const SessionContext = createContext<SessionValue | null>(null);

interface State {
  token: string | null;
  user: User | null;
  companyId: number | null;
  biometricEnabled: boolean;
}

const EMPTY: State = { token: null, user: null, companyId: null, biometricEnabled: false };

/** Qué empresa abrir al entrar: la que había activa si sigue vigente, si no la primera. */
function pickCompany(user: User, preferred: number | null): number | null {
  if (preferred != null && user.companies.some((company) => company.id === preferred)) return preferred;
  return user.companies[0]?.id ?? null;
}

export function SessionProvider({ children, onSignedOut }: PropsWithChildren<{ onSignedOut?: () => void }>) {
  const [state, setState] = useState<State>(EMPTY);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const stateRef = useRef(state);
  const onSignedOutRef = useRef(onSignedOut);
  useEffect(() => {
    onSignedOutRef.current = onSignedOut;
  }, [onSignedOut]);

  const persist = useCallback(async (next: State) => {
    setState(next);
    stateRef.current = next;
    if (next.token && next.user && next.companyId != null) {
      await writeSession({ token: next.token, user: next.user, companyId: next.companyId, biometricEnabled: next.biometricEnabled });
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setState(EMPTY);
    stateRef.current = EMPTY;
    setStatus("signedOut");
    onSignedOutRef.current?.();
  }, []);

  useEffect(() => {
    configureClient({
      getToken: () => stateRef.current.token,
      getCompanyId: () => stateRef.current.companyId,
      getLocale,
      onUnauthorized: () => void signOut(),
    });
  }, [signOut]);

  // Al abrir: restaura la sesión guardada; con biometría activa queda bloqueada hasta confirmar (FR-003).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await readSession();
      if (cancelled) return;
      if (!saved) return setStatus("signedOut");
      const next = { token: saved.token, user: saved.user, companyId: saved.companyId, biometricEnabled: saved.biometricEnabled };
      setState(next);
      stateRef.current = next;
      setStatus(saved.biometricEnabled && (await biometricAvailable()) ? "locked" : "signedIn");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { token, user } = await api.post<AuthResponse>("/api/v1/auth/login", {
        body: { email: email.trim().toLowerCase(), password },
        skipUnauthorized: true,
      });
      const companyId = pickCompany(user, null);
      await persist({ token, user, companyId, biometricEnabled: false });
      setStatus("signedIn");
    },
    [persist],
  );

  const setCompany = useCallback(
    async (companyId: number) => persist({ ...stateRef.current, companyId }),
    [persist],
  );

  const setUser = useCallback(
    async (user: User) => persist({ ...stateRef.current, user, companyId: pickCompany(user, stateRef.current.companyId) }),
    [persist],
  );

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled && !(await biometricAvailable())) return false;
      if (enabled && !(await authenticateBiometric())) return false;
      await persist({ ...stateRef.current, biometricEnabled: enabled });
      return true;
    },
    [persist],
  );

  const unlock = useCallback(async () => {
    const ok = await authenticateBiometric();
    if (ok) setStatus("signedIn");
    return ok;
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user: state.user,
      token: state.token,
      companyId: state.companyId,
      role: state.user && state.companyId != null ? roleIn(state.user, state.companyId) : null,
      biometricEnabled: state.biometricEnabled,
      signIn,
      signOut,
      setCompany,
      setUser,
      setBiometricEnabled,
      unlock,
    }),
    [status, state, signIn, signOut, setCompany, setUser, setBiometricEnabled, unlock],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession fuera de SessionProvider");
  return value;
}

/** Quien puede crear y editar órdenes de todo el negocio (FR-025). */
export function isBossRole(role: CompanyRole | null): boolean {
  return role === "manager" || role === "admin" || role === "owner";
}
