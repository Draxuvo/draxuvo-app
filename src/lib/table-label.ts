import { t } from "@/i18n";

const PREFIXED = /^(mesa|table)\b/i;

/** "Mesa 4" para una mesa llamada "4", pero sin repetir la palabra si la mesa ya se llama "Mesa 1". */
export function tableLabel(key: "check.table" | "ticket.table" | "orders.openChecks.table", name: string): string {
  return PREFIXED.test(name.trim()) ? name : t(key, { name });
}
