import { getLocale } from "@/i18n";

const TIME_ZONE = "America/Mexico_City";

/** Hora corta (HH:mm) en la zona del servidor, en el idioma de la app. */
export function shortTime(iso: string): string {
  return new Intl.DateTimeFormat(getLocale() === "es" ? "es-MX" : "en-US", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
