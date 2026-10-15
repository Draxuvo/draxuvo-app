import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { CompanyRole, User } from "@/api/types";

const KEY = "draxuvo.session";

// En web no hay almacén seguro: se usa localStorage, solo para probar la app en el navegador.
const storage = {
  get: async (key: string) => (Platform.OS === "web" ? localStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: async (key: string, value: string) =>
    Platform.OS === "web" ? void localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  remove: async (key: string) =>
    Platform.OS === "web" ? void localStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

export interface StoredSession {
  token: string;
  user: User;
  companyId: number;
  biometricEnabled: boolean;
}

export async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await storage.get(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.token && parsed.user ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeSession(session: StoredSession): Promise<void> {
  await storage.set(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  try {
    await storage.remove(KEY);
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
