import type { CompanyRole, User } from "@/api/types";
import { roleIn } from "@/session/store";

// Qué hacer al tocar un aviso push (spec 057, FR-017, contracts/push-message.md).

export interface PushData {
  kind: string;
  companyId: number | null;
  path: string;
}

// Spec 058: `/venta?venta=<id>` es una venta de mostrador que espera cobro; la caja solo vive en el panel.
const SALE = /^\/venta\?venta=\d+$/;
const ALLOWED = [/^\/pedido\?cuenta=\d+(&hoja=1)?$/, /^\/ordenes\/\d+$/, /^\/alertas$/, SALE];
const FALLBACK = "/ordenes";
const BOSSES: CompanyRole[] = ["admin", "owner"];

/** Lee `data` del aviso; una ruta que no es de las conocidas cae en Órdenes. */
export function parsePushData(raw: unknown): PushData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.kind !== "string") return null;
  const companyId = typeof data.company_id === "number" ? data.company_id : Number(data.company_id) || null;
  const path = typeof data.path === "string" && ALLOWED.some((pattern) => pattern.test(data.path as string)) ? data.path : FALLBACK;
  return { kind: data.kind, companyId, path };
}

/** `notice: "posOnly"` (spec 058): el aviso es de una venta de mostrador, que se cobra desde la caja del panel. */
export type OpenPlan = { action: "open"; switchTo: number | null; path: string; notice?: "posOnly" } | { action: "noAccess" };

/** Cambia de empresa si el aviso es de otra y la persona sigue en ella; Alertas solo para jefes (FR-018). */
export function planOpen(data: PushData, user: User, activeCompanyId: number | null): OpenPlan {
  const target = data.companyId ?? activeCompanyId;
  if (target == null || !user.companies.some((company) => company.id === target)) return { action: "noAccess" };
  const role = roleIn(user, target);
  const switchTo = target !== activeCompanyId ? target : null;
  if (SALE.test(data.path)) return { action: "open", switchTo, path: FALLBACK, notice: "posOnly" };
  const path = data.path === "/alertas" && !(role && BOSSES.includes(role)) ? FALLBACK : data.path;
  return { action: "open", switchTo, path };
}
