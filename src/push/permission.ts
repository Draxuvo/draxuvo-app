import * as Notifications from "expo-notifications";
import { pushAvailable } from "./config";
import { readJson, writeJson } from "./storage";

/** Estado del permiso de avisos del sistema (spec 057, FR-001 y FR-008). */
export type PushPermission = "granted" | "askable" | "blocked" | "unavailable";

export async function permissionState(): Promise<PushPermission> {
  if (!pushAvailable()) return "unavailable";
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) return "granted";
  return permission.canAskAgain ? "askable" : "blocked";
}

/** Abre el diálogo del sistema; devuelve si quedó concedido. */
export async function requestPermission(): Promise<boolean> {
  const permission = await Notifications.requestPermissionsAsync();
  return permission.granted;
}

const askedKey = (userId: number) => `draxuvo.push-asked.${userId}`;

/** La hoja «Activa los avisos» sale una sola vez por persona en este teléfono. */
export async function wasAsked(userId: number): Promise<boolean> {
  return (await readJson<boolean>(askedKey(userId))) === true;
}

export async function markAsked(userId: number): Promise<void> {
  await writeJson(askedKey(userId), true);
}
