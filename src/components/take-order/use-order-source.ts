import { useQuery } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useRef } from "react";
import { listOrders } from "@/api/orders";
import { sendRound } from "@/api/restaurant";
import type { Check, RoundResponse, WorkOrder } from "@/api/types";
import { POLL_MS, useApplyCheck, useCheck, useCheckActions, useOpenCheck, useTables } from "@/hooks/use-restaurant";
import { useOpenOrder, useOrder, useOrderItemActions } from "@/hooks/use-orders";
import { useSession } from "@/session";
import { inOrderCount, tapProduct, type Line, type MenuCard } from "./lib";

// La pantalla de tomar pedido se escribe una vez; este hook le da, según el modo, los mosaicos, la orden
// elegida y las acciones sobre cuentas de mesa (restaurante) u órdenes de trabajo en modo pedido (spec 018, R3).

export type Selection = { kind: "check"; id: number } | { kind: "order"; id: number } | null;

export interface SourceTile {
  key: string;
  name: string;
  state: "free" | "occupied";
  total: number;
  owner: string | null;
  mine: boolean;
  ready: number;
  selection: Selection;
  /** Mesa libre: al tocarla se abre su cuenta. */
  tableId?: number;
}

export interface CurrentOrder {
  selection: NonNullable<Selection>;
  title: string;
  lines: Line[];
  total: number;
  canAdd: boolean;
  canSend: boolean;
  canCharge: boolean;
  check?: Check;
  order?: WorkOrder;
}

const num = (value: string | number | null | undefined) => Number(value ?? 0) || 0;

export function checkLines(check: Check): Line[] {
  return check.items.map((i) => ({
    id: i.id,
    product_id: null,
    name: i.name,
    quantity: i.quantity,
    note: i.note,
    unit_price: num(i.unit_price),
    editable: i.status === "draft",
    sent: i.status !== "draft",
    cancelled: i.status === "cancelled",
  }));
}

export function orderLines(order: WorkOrder): Line[] {
  const editable = order.status === "open" || order.status === "in_progress";
  return (order.items ?? []).map((i) => ({
    id: i.id,
    product_id: i.product_id ?? null,
    name: i.description,
    quantity: Number(i.quantity),
    unit_price: num(i.unit_price),
    editable,
    sent: false,
  }));
}

export function useOrderSource(mode: "restaurant" | "orders", selection: Selection) {
  const { companyId } = useSession();
  const restaurant = mode === "restaurant";
  const apply = useApplyCheck();
  const sendKey = useRef<string | null>(null);

  // ── Cuentas de mesa
  const overview = useTables(restaurant);
  const checkId = selection?.kind === "check" ? selection.id : 0;
  const check = useCheck(checkId, restaurant);
  const checkActions = useCheckActions(checkId);
  const openCheck = useOpenCheck();

  // ── Órdenes de trabajo
  const orders = useQuery({
    queryKey: ["company", companyId, "orders", "pedido"],
    queryFn: () => listOrders({ sort_by: "urgency" }),
    enabled: !restaurant,
    refetchInterval: POLL_MS,
  });
  const orderId = selection?.kind === "order" ? selection.id : 0;
  const order = useOrder(orderId, !restaurant && !!orderId);
  const orderActions = useOrderItemActions(orderId);
  const openOrder = useOpenOrder();

  let tiles: SourceTile[] = [];
  if (restaurant) {
    tiles = [
      ...(overview.data?.results ?? []).filter((t) => t.active).map((t): SourceTile => ({
        key: `table:${t.id}`,
        name: t.name,
        state: t.check ? "occupied" : "free",
        total: num(t.check?.total),
        owner: t.check?.waiter?.name ?? null,
        mine: !!t.check?.mine,
        ready: t.check?.counts.ready ?? 0,
        selection: t.check ? { kind: "check", id: t.check.id } : null,
        tableId: t.id,
      })),
      ...(overview.data?.takeouts ?? []).map((c): SourceTile => ({
        key: `check:${c.id}`,
        name: c.takeout_name,
        state: "occupied",
        total: num(c.total),
        owner: c.waiter?.name ?? null,
        mine: c.mine,
        ready: c.counts.ready,
        selection: { kind: "check", id: c.id },
      })),
    ];
  } else {
    tiles = (orders.data?.results ?? [])
      .filter((o) => o.status === "open" || o.status === "in_progress" || o.status === "done")
      .map((o): SourceTile => ({
        key: `order:${o.id}`,
        name: o.title,
        state: "occupied",
        total: num(o.total),
        owner: o.employee?.name ?? null,
        mine: false,
        ready: 0,
        selection: { kind: "order", id: o.id },
      }));
  }

  let current: CurrentOrder | null = null;
  if (restaurant && check.data && selection?.kind === "check") {
    const c = check.data;
    const open = c.status === "open";
    const drafts = c.items.filter((i) => i.status === "draft");
    current = {
      selection,
      title: c.table?.name ?? c.takeout_name ?? "",
      lines: checkLines(c),
      // El total que ve el mesero incluye lo que aún no manda; la API solo cobra lo ya mandado.
      total: num(c.total) + drafts.reduce((sum, i) => sum + num(i.unit_price) * i.quantity, 0),
      canAdd: open && c.allowed_actions.includes("add_item"),
      canSend: open && c.allowed_actions.includes("send") && drafts.length > 0,
      canCharge: open && c.allowed_actions.includes("pay") && !drafts.length && c.items.length > 0,
      check: c,
    };
  } else if (!restaurant && order.data && selection?.kind === "order") {
    const o = order.data;
    const open = o.status === "open" || o.status === "in_progress";
    const actions = o.allowed_actions ?? [];
    current = {
      selection,
      title: o.title,
      lines: orderLines(o),
      total: num(o.total),
      canAdd: open,
      canSend: false,
      canCharge: (o.items_count ?? 0) > 0 && (actions.includes("charge") || (open && actions.includes("finish"))),
      order: o,
    };
  }

  /** Abre la cuenta de una mesa libre, una cuenta para llevar o una orden con ese nombre. */
  async function create(target: { tableId: number } | { name: string }): Promise<NonNullable<Selection>> {
    if (restaurant) {
      const opened = await openCheck.mutateAsync("tableId" in target ? { dining_table_id: target.tableId } : { takeout_name: target.name });
      return { kind: "check", id: opened.id };
    }
    const created = await openOrder.mutateAsync("name" in target ? target.name : "");
    return { kind: "order", id: created.id };
  }

  async function setQuantity(line: Line, quantity: number) {
    if (quantity < 1) return remove(line);
    if (restaurant) return checkActions.update.mutateAsync({ itemId: line.id, quantity });
    return orderActions.update.mutateAsync({ itemId: line.id, quantity });
  }

  async function remove(line: Line) {
    if (restaurant) return checkActions.remove.mutateAsync(line.id);
    return orderActions.remove.mutateAsync(line.id);
  }

  /** Tocar una tarjeta: sube el renglón editable del producto o agrega uno con cantidad 1. */
  async function tap(card: MenuCard) {
    if (!current) return;
    const result = tapProduct(current.lines, card);
    if (result.kind === "increment") return setQuantity(result.line, result.line.quantity + 1);
    if (restaurant) return checkActions.add.mutateAsync({ product_id: card.id, quantity: 1 });
    return orderActions.add.mutateAsync({ product_id: card.id, quantity: 1 });
  }

  /** La llave del envío se conserva hasta el 2xx: reintentar por mala red nunca duplica la comanda. */
  async function send(): Promise<RoundResponse> {
    sendKey.current ??= Crypto.randomUUID();
    const result = await sendRound(checkId, sendKey.current);
    sendKey.current = null;
    apply(result.check);
    return result;
  }

  return {
    mode,
    tiles,
    loading: restaurant ? overview.isLoading : orders.isLoading,
    error: restaurant ? overview.isError && !overview.data : orders.isError && !orders.data,
    alerts: restaurant ? overview.data?.stock_alerts ?? 0 : 0,
    refetch: () => void (restaurant ? overview.refetch() : orders.refetch()),
    refreshing: restaurant ? overview.isRefetching : orders.isRefetching,
    current,
    currentLoading: restaurant ? check.isLoading && !!checkId : order.isLoading && !!orderId,
    create,
    tap,
    setQuantity,
    remove,
    send,
    inOrder: (card: MenuCard) => (current ? inOrderCount(current.lines, card) : 0),
  };
}
