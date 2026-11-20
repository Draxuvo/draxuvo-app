// Spec 071: errores de JavaScript y cierres nativos de la app a Sentry. Sin EXPO_PUBLIC_SENTRY_DSN (desarrollo, pruebas,
// compilaciones sin la variable) no se inicializa y todo esto no hace nada. El SDK nativo llega con una compilación de
// EAS; si el módulo nativo no está (una compilación anterior), se inicializa solo la parte de JavaScript.
// Privacidad (contracts/error-event.md de la spec): solo el id del usuario y de la empresa; sin capturas de pantalla, sin
// jerarquía de vistas, sin query string y sin la consola.
import * as Sentry from "@sentry/react-native";
import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";
import { NativeModules, TurboModuleRegistry } from "react-native";

let initialized = false;

/** Quita query string y hash. */
export function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.split(/[?#]/, 1)[0];
}

export function beforeSend(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.url = scrubUrl(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
  }
  event.user = event.user?.id !== undefined ? { id: event.user.id } : undefined;
  return event;
}

export function beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const data = breadcrumb.data;
  if (data && typeof data.url === "string") data.url = scrubUrl(data.url);
  if (breadcrumb.category === "console") return null;
  return breadcrumb;
}

function hasNativeSentry(): boolean {
  try {
    return Boolean(TurboModuleRegistry.get("RNSentry") ?? NativeModules.RNSentry);
  } catch {
    return false;
  }
}

/** Inicializa Sentry una sola vez y solo con DSN. Devuelve si quedó activo. */
export function initMonitoring(dsn = process.env.EXPO_PUBLIC_SENTRY_DSN): boolean {
  if (initialized) return true;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || "production",
    enableNative: hasNativeSentry(),
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    beforeSend,
    beforeBreadcrumb,
  });
  initialized = true;
  return true;
}

export function isMonitoringActive(): boolean {
  return initialized;
}

/** Usuario y empresa activa: solo ids. Sin sesión, los borra. */
export function setMonitoringUser(userId: number | null | undefined, companyId: number | null | undefined, demo = false) {
  if (!initialized) return;
  Sentry.setUser(userId ? { id: String(userId) } : null);
  Sentry.setTag("company_id", companyId ? String(companyId) : undefined);
  Sentry.setTag("demo", companyId ? String(demo) : undefined);
}

/** Pantalla actual (ruta de expo-router, sin query): ayuda a ubicar el error. */
export function setMonitoringScreen(pathname: string | null | undefined) {
  if (!initialized) return;
  Sentry.setTag("screen", scrubUrl(pathname ?? undefined));
}
