import { api } from "./client";
import type { PushDeviceResponse, PushKind, PushPreference } from "./types";

/** Credenciales guardadas para dar de baja el teléfono después de cerrar sesión (spec 057, research R3). */
export interface SavedAuth {
  jwt: string;
  companyId: number | null;
}

/** Alta o refresco del teléfono de la persona (spec 057, FR-002). */
export const registerDevice = (data: { token: string; platform: "android" | "ios"; locale: string; app_version: string }) =>
  api.post<PushDeviceResponse>("/api/v1/push_devices", { body: data });

/**
 * Baja del teléfono (FR-003). Con `auth` usa el JWT y la empresa guardados (la sesión ya se cerró); nunca dispara el
 * cierre de sesión por un 401.
 */
export const unregisterDevice = (token: string, auth?: SavedAuth) => {
  const headers: Record<string, string> = {};
  if (auth) {
    headers.Authorization = `Bearer ${auth.jwt}`;
    if (auth.companyId != null) headers["X-Company-Id"] = String(auth.companyId);
  }
  return api.delete<void>(`/api/v1/push_devices/${encodeURIComponent(token)}`, { headers, skipUnauthorized: true });
};

export const getPushPreference = () => api.get<PushPreference>("/api/v1/push_preference");

export const updatePushPreference = (patch: Partial<Record<PushKind, boolean>>) =>
  api.patch<PushPreference>("/api/v1/push_preference", { body: patch });
