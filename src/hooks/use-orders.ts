import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useOrders(filters: Omit<OrderListParams, "page"> = {}, enabled = true) {
  const keys = useKeys();
  return useInfiniteQuery({
    queryKey: keys.orders(filters),
    queryFn: ({ pageParam }) => listOrders({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.info.page_end < last.info.total ? last.info.page_index + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useOrder(id: number, enabled = true) {
  const keys = useKeys();
  return useQuery({ queryKey: keys.order(id), queryFn: () => getOrder(id), enabled });
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
