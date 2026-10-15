import * as SecureStore from "expo-secure-store";
import type { CompanyRole, User } from "@/api/types";

const KEY = "draxuvo.session";

export interface StoredSession {
  token: string;
  user: User;
  companyId: number;
  biometricEnabled: boolean;
}

export async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.token && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nada que borrar.
  }
}

/** Rol de la persona en la empresa activa; super admin cuenta como dueño. */
export function roleIn(user: User, companyId: number): CompanyRole | null {
  const membership = user.companies.find((company) => company.id === companyId);
  if (membership) return membership.role;
  return user.role === "super_admin" ? "owner" : null;
}
