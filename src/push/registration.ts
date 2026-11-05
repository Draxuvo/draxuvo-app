import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ApiError, appVersion } from "@/api/client";
import { registerDevice, unregisterDevice, type SavedAuth } from "@/api/push";
import { getLocale } from "@/i18n";
import { pushAvailable, pushProjectId } from "./config";
import { readJson, removeKey, writeJson } from "./storage";

// Registro del teléfono para los avisos push (spec 057, FR-002, FR-003, research R3).

export const DEVICE_KEY = "draxuvo.push-device";
export const PENDING_KEY = "draxuvo.push-unregister";
/** Sin cambios, el registro se refresca como mucho cada 12 h (FR-002). */
export const REFRESH_MS = 12 * 60 * 60 * 1000;
/** Un JWT dura 24 h: después, la baja pendiente ya no se puede autenticar y la cubren FR-002 y FR-004. */
export const PENDING_MS = 24 * 60 * 60 * 1000;
const SIGN_OUT_TIMEOUT_MS = 3000;

interface SavedDevice {
  token: string;
  userId: number;
  locale: string;
  registeredAt: number;
}

interface PendingUnregister extends SavedAuth {
  token: string;
  savedAt: number;
}

/** Token de Expo de este teléfono, o `null` si esta compilación o este aparato no tienen avisos. */
export async function currentToken(): Promise<string | null> {
  const projectId = pushProjectId();
  if (!pushAvailable() || !projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

/** Registra el teléfono para `userId` si hay permiso y algo cambió (token, persona, idioma) o pasaron 12 h. */
export async function ensureRegistered(userId: number, now = Date.now()): Promise<boolean> {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return false;
  const token = await currentToken();
  if (!token) return false;

  const locale = getLocale();
  const saved = await readJson<SavedDevice>(DEVICE_KEY);
  const fresh = saved && saved.token === token && saved.userId === userId && saved.locale === locale && now - saved.registeredAt < REFRESH_MS;
  if (fresh) return true;

  try {
    await registerDevice({ token, platform: Platform.OS === "ios" ? "ios" : "android", locale, app_version: appVersion() });
    await writeJson(DEVICE_KEY, { token, userId, locale, registeredAt: now } satisfies SavedDevice);
    return true;
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Al cerrar sesión: da de baja el teléfono con el JWT que aún se tiene. Sin red (o si tarda más de 3 s) deja la baja
 * pendiente para reintentarla; un rechazo de la API (JWT vencido) no se reintenta.
 */
export async function unregisterOnSignOut(auth: { jwt: string | null; companyId: number | null }, now = Date.now()): Promise<void> {
  const saved = await readJson<SavedDevice>(DEVICE_KEY);
  await removeKey(DEVICE_KEY);
  if (!saved || !auth.jwt) return;
  const credentials: SavedAuth = { jwt: auth.jwt, companyId: auth.companyId };
  try {
    await withTimeout(unregisterDevice(saved.token, credentials), SIGN_OUT_TIMEOUT_MS);
  } catch (error) {
    if (error instanceof ApiError) return;
    await writeJson(PENDING_KEY, { token: saved.token, ...credentials, savedAt: now } satisfies PendingUnregister);
  }
}

/** Reintenta la baja pendiente mientras su JWT pueda seguir vigente. */
export async function flushPendingUnregister(now = Date.now()): Promise<void> {
  const pending = await readJson<PendingUnregister>(PENDING_KEY);
  if (!pending) return;
  if (now - pending.savedAt > PENDING_MS) return removeKey(PENDING_KEY);
  try {
    await unregisterDevice(pending.token, { jwt: pending.jwt, companyId: pending.companyId });
    await removeKey(PENDING_KEY);
  } catch (error) {
    if (error instanceof ApiError) await removeKey(PENDING_KEY);
  }
}
