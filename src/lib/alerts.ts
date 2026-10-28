import type { OperationalAlert } from "@/api/types";
import { getLocale, t } from "@/i18n";

/** "190 min" como "3 h 10 min" (alertas operativas, spec 045). */
export function formatElapsed(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return t("alerts.time.minutes", { count: total });

  if (total < 1440) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? t("alerts.time.hours", { count: hours }) : t("alerts.time.hoursMinutes", { hours, minutes: rest });
  }

  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  return hours === 0 ? t("alerts.time.days", { count: days }) : t("alerts.time.daysHours", { days, hours });
}

export function formatMoney(amount: string): string {
  return new Intl.NumberFormat(getLocale() === "en" ? "en-US" : "es-MX", { style: "currency", currency: "MXN" }).format(Number(amount));
}

/** Pantalla a la que lleva "Abrir": la cuenta (Tomar pedido) o la orden; el inventario no existe en la app. */
export function alertRoute(alert: OperationalAlert): string | null {
  const { subject } = alert;
  if (subject.type === "work_order") return `/ordenes/${subject.id}`;
  if (subject.type === "product") return null;
  return `/pedido?cuenta=${subject.check_id ?? subject.id}&hoja=1`;
}
