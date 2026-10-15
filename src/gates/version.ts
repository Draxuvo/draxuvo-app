import { Platform } from "react-native";
import { fetchAppConfig } from "@/api/config";
import { appVersion } from "@/api/client";

/** Compara dos versiones `x.y.z`; devuelve negativo, 0 o positivo. Las partes que faltan valen 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((part) => parseInt(part, 10) || 0);
  const pb = b.split(".").map((part) => parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** `true` solo si la API respondió y la versión instalada es menor que la mínima de su plataforma. */
export async function mustUpdate(): Promise<boolean> {
  const config = await fetchAppConfig();
  if (!config) return false;
  const min = Platform.OS === "ios" ? config.min_app_version.ios : config.min_app_version.android;
  return compareVersions(appVersion(), min) < 0;
}
