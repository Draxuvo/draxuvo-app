import { api } from "./client";
import type { AppConfig } from "./types";

/** Versión mínima publicada por la API. Sin respuesta en 5 s devuelve `null` y la app sigue (FR-027). */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    return await api.get<AppConfig>("/api/v1/app_config", { signal: controller.signal, skipUnauthorized: true });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
