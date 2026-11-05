import Constants from "expo-constants";
import * as Device from "expo-device";

/** Proyecto de EAS con el que Expo emite el token (spec 057, research R2). Sin él, la app no pide avisos. */
export function pushProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/** Hay avisos push en esta compilación y en este aparato (no en un emulador sin servicios). */
export function pushAvailable(): boolean {
  return Device.isDevice && pushProjectId() != null;
}
