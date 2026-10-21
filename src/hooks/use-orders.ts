import { keepPreviousData, useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addOrderItem,
  createOrder,
  deleteOrderItem,
  getOrder,
  listEmployees,
  listOrders,
  setStepDone,
  transitionOrder,
  updateOrderItem,
  type OrderListParams,
  type OrderTransition,
} from "@/api/orders";
import type { WorkOrder } from "@/api/types";
import { useAppActive } from "@/hooks/use-restaurant";
import { useSession } from "@/session";

/** Toda clave lleva la empresa activa: cambiar de empresa no mezcla datos (FR-004). */
export function useKeys() {
  const { companyId } = useSession();
  return {
    all: ["company", companyId] as const,
    orders: (filters?: OrderListParams) => ["company", companyId, "orders", filters ?? {}] as const,
    order: (id: number) => ["company", companyId, "order", id] as const,
    employees: ["company", companyId, "employees"] as const,
    tickets: (filters?: object) => ["company", companyId, "tickets", filters ?? {}] as const,
    ticket: (id: number) => ["company", companyId, "ticket", id] as const,
  };
}

export function useOrders(filters: Omit<OrderListParams, "page"> = {}, enabled = true, pollMs?: number) {
  const keys = useKeys();
  const active = useAppActive();
  return useInfiniteQuery({
    queryKey: keys.orders(filters),
    queryFn: ({ pageParam }) => listOrders({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.info.page_end < last.info.total ? last.info.page_index + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled,
    // Sondeo solo cuando la lista está a la vista y la app activa (spec 021).
    refetchInterval: pollMs && active ? pollMs : false,
  });
}

/** Hoy en la zona del teléfono, como `yyyy-MM-dd` (la API lo interpreta en hora de Ciudad de México). */
export function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type OrderCounts = Record<"open" | "in_progress" | "done" | "paid", number>;

/**
 * Cuántas órdenes hay por estado, para los contadores de las pestañas (spec 023). Una consulta mínima por estado
 * (`page_size=1`, solo importa `info.total`); Cobradas cuenta las de hoy. Respeta el filtro por responsable.
 */
export function useOrderCounts(filters: { employee_id?: number } = {}, pollMs?: number, enabled = true): OrderCounts {
  const keys = useKeys();
  const active = useAppActive();
  const today = todayISO();
  const statuses = ["open", "in_progress", "done", "paid"] as const;
  const results = useQueries({
    queries: statuses.map((status) => ({
      queryKey: [...keys.all, "orders", "count", status, filters, status === "paid" ? today : null] as const,
      queryFn: () => listOrders({ status, ...filters, page_size: 1, ...(status === "paid" ? { paid_on: today } : {}) }),
      select: (page: Awaited<ReturnType<typeof listOrders>>) => page.info.total,
      enabled,
      refetchInterval: pollMs && active ? pollMs : (false as const),
    })),
  });
  return { open: results[0].data ?? 0, in_progress: results[1].data ?? 0, done: results[2].data ?? 0, paid: results[3].data ?? 0 };
}

export function useOrder(id: number, enabled = true, pollMs?: number) {
  const keys = useKeys();
  const active = useAppActive();
  return useQuery({
    queryKey: keys.order(id),
    queryFn: () => getOrder(id),
    enabled,
    refetchInterval: pollMs && active ? pollMs : false,
  });
}

export function useEmployees(enabled = true) {
  const keys = useKeys();
  return useQuery({ queryKey: keys.employees, queryFn: listEmployees, enabled, staleTime: 5 * 60_000 });
}

/** Deja en caché la orden que devolvió la API y marca las listas para recargar. */
export function useApplyOrder() {
  const client = useQueryClient();
  const keys = useKeys();
  return (order: WorkOrder) => {
    client.setQueryData(keys.order(order.id), order);
    void client.invalidateQueries({ queryKey: [...keys.all, "orders"] });
    void client.invalidateQueries({ queryKey: [...keys.all, "tickets"] });
  };
}

export function useOrderTransition(id: number) {
  const apply = useApplyOrder();
  return useMutation({
    mutationFn: (action: OrderTransition) => transitionOrder(id, action),
    onSuccess: apply,
  });
}

export function useToggleStep(orderId: number) {
  const apply = useApplyOrder();
  return useMutation({
    mutationFn: ({ stepId, done }: { stepId: number; done: boolean }) => setStepDone(orderId, stepId, done),
    onSuccess: apply,
  });
}

/** Renglones de una orden de trabajo para la pantalla de tomar pedido (spec 018). */
export function useOrderItemActions(orderId: number) {
  const apply = useApplyOrder();
  return {
    add: useMutation({
      mutationFn: (body: { product_id: number; quantity: number }) => addOrderItem(orderId, body),
      onSuccess: apply,
    }),
    update: useMutation({
      mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) => updateOrderItem(orderId, itemId, { quantity }),
      onSuccess: apply,
    }),
    remove: useMutation({ mutationFn: (itemId: number) => deleteOrderItem(orderId, itemId), onSuccess: apply }),
  };
}

/** Abre una orden de trabajo con solo su nombre (mesa o cliente); los productos se agregan después. */
export function useOpenOrder() {
  const apply = useApplyOrder();
  return useMutation({ mutationFn: (title: string) => createOrder({ work_order: { title } }), onSuccess: apply });
}
