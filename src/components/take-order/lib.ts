// Reglas puras de la pantalla de tomar pedido (spec 018). No tocan red ni React; misma forma que en draxuvo-ui.
import type { CheckItem, OrderMode } from "@/api/types";

export type ScreenMode = "restaurant" | "orders" | "none";

/** Con el módulo de restaurante: cuentas de mesa; si no, y en modo pedido: órdenes de trabajo; si no, formulario actual. */
export function screenMode(activeModules: readonly string[], orderMode: OrderMode | undefined): ScreenMode {
  if (activeModules.includes("restaurant")) return "restaurant";
  return orderMode === "order" ? "orders" : "none";
}

/** Minúsculas y sin acentos, para buscar sin distinguir. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export interface MenuCard {
  id: number;
  name: string;
  price: number;
  icon?: string | null;
  product_type?: { icon?: string | null } | null;
  sold_out?: boolean;
  low?: boolean;
  available_qty?: number | null;
}

export interface MenuSection {
  category: string;
  items: MenuCard[];
}

/** Grupos con solo los productos cuyo nombre contiene el término; descarta los grupos vacíos. */
export function filterMenu(menu: MenuSection[], term: string): MenuSection[] {
  const needle = normalize(term);
  if (!needle) return menu;
  return menu
    .map((section) => ({ ...section, items: section.items.filter((i) => normalize(i.name).includes(needle)) }))
    .filter((section) => section.items.length > 0);
}

/** Renglón de una cuenta (`CheckItem`) o de una orden (`WorkOrderItem`) con la forma común de la pantalla. */
export interface Line {
  id: number;
  product_id?: number | null;
  name: string;
  icon?: string | null;
  type_icon?: string | null;
  quantity: number;
  note?: string | null;
  unit_price: number;
  /** Se puede cambiar: borrador en una cuenta; cualquiera en una orden abierta. */
  editable: boolean;
  /** Ya se mandó a la cocina o la barra. */
  sent: boolean;
  cancelled?: boolean;
}

/** El renglón de una cuenta no trae el producto (solo su nombre); el de una orden sí. */
function sameProduct(line: Line, product: Pick<MenuCard, "id" | "name">): boolean {
  return line.product_id != null ? line.product_id === product.id : line.name === product.name;
}

export type TapResult = { kind: "increment"; line: Line } | { kind: "add" };

/** Tocar una tarjeta sube el renglón editable del producto (sin nota) o agrega uno nuevo. */
export function tapProduct(lines: Line[], product: Pick<MenuCard, "id" | "name">): TapResult {
  const line = lines.find((l) => sameProduct(l, product) && l.editable && !l.cancelled && !l.note);
  return line ? { kind: "increment", line } : { kind: "add" };
}

/** Cantidad del producto en los renglones editables, para el contador de la tarjeta. */
export function inOrderCount(lines: Line[], product: Pick<MenuCard, "id" | "name">): number {
  return lines
    .filter((l) => sameProduct(l, product) && l.editable && !l.cancelled)
    .reduce((sum, l) => sum + l.quantity, 0);
}

/** Suma de cantidad por precio de los renglones no cancelados. */
export function runningTotal(lines: Line[]): number {
  const total = lines.filter((l) => !l.cancelled).reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  return Math.round(total * 100) / 100;
}

const PALETTE = ["#2340C8", "#13795A", "#C92F26", "#8A5A00", "#6B3FA0"];

/** Color estable por categoría: el mismo nombre da siempre el mismo color. */
export function categoryColor(category: string): string {
  let hash = 0;
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Resumen de la orden para la barra: cuántos productos lleva y cuánto suma (sin renglones cancelados). */
export function orderSummary(lines: Line[]): { count: number; total: number } {
  const live = lines.filter((l) => !l.cancelled);
  return { count: live.reduce((sum, l) => sum + l.quantity, 0), total: runningTotal(live) };
}

/** Productos ya mandados agrupados por comanda, en orden de comanda (spec 025). */
export function groupByRound(items: CheckItem[]): { number: number; items: CheckItem[] }[] {
  const rounds = new Map<number, CheckItem[]>();
  for (const item of items) {
    if (item.kitchen_order_number == null) continue;
    rounds.set(item.kitchen_order_number, [...(rounds.get(item.kitchen_order_number) ?? []), item]);
  }
  return [...rounds.entries()].sort(([a], [b]) => a - b).map(([number, list]) => ({ number, items: list }));
}
