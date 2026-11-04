import { t } from "@/i18n";
import type { ScanReason } from "@/lib/scan";

/** Aviso de una lectura que no se pudo agregar (FR-010): siempre dice el código leído y el motivo. */
export function scanFailureText(code: string, failure: { reason: ScanReason; name?: string }): string {
  const key = failure.reason === "not_sellable" ? "notSellable" : failure.reason === "not_on_menu" ? "notOnMenu" : "notFound";
  return t(`scan.${key}`, { code, name: failure.name ?? code });
}
