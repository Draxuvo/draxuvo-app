import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import {
  addItem,
  cancelCheck,
  cancelItem,
  deliverItem,
  getCheck,
  getRestaurantMenu,
  listTables,
  listWaiters,
  openCheck,
  reassignCheck,
  removeItem,
  updateItem,
} from "@/api/restaurant";
import { ApiError } from "@/api/client";
import type { Check } from "@/api/types";
import { useSession } from "@/session";

/** El plano de mesas y la cuenta abierta se consultan cada 4 s mientras la app está activa (research R2). */
export const POLL_MS = 4000;

export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => sub.remove();
  }, []);
  return active;
}

export function useRestaurantKeys() {
  const { companyId } = useSession();
  return {
    all: ["company", companyId, "restaurant"] as const,
    tables: ["company", companyId, "restaurant", "tables"] as const,
    check: (id: number) => ["company", companyId, "restaurant", "check", id] as const,
    menu: ["company", companyId, "restaurant", "menu"] as const,
  };
}

/** La API contesta 403 `module_not_in_plan` (o suscripción vencida) si la empresa no tiene restaurante. */
function isBlocked(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export function useTables(enabled = true) {
  const keys = useRestaurantKeys();
  const active = useAppActive();
  return useQuery({
    queryKey: keys.tables,
    queryFn: listTables,
    enabled,
    retry: false,
    refetchInterval: (query) => (active && !isBlocked(query.state.error) ? POLL_MS : false),
  });
}

/**
 * La pestaña Mesas solo existe si la empresa tiene el módulo. Staff no puede leer la suscripción,
 * así que la respuesta del plano de mesas decide: sin datos y sin error aún, no se muestra.
 */
export function useRestaurantEnabled(): boolean {
  const tables = useTables();
  return !!tables.data || (tables.isError && !isBlocked(tables.error));
}

export function useWaiters(enabled = true) {
  const keys = useRestaurantKeys();
  return useQuery({ queryKey: [...keys.all, "waiters"], queryFn: listWaiters, enabled, staleTime: 60_000 });
}

export function useCheck(id: number, enabled = true) {
  const keys = useRestaurantKeys();
  const active = useAppActive();
  return useQuery({
    queryKey: keys.check(id),
    queryFn: () => getCheck(id),
    enabled: enabled && !!id,
    refetchInterval: active ? POLL_MS : false,
  });
}

export function useRestaurantMenu(enabled = true) {
  const keys = useRestaurantKeys();
  return useQuery({ queryKey: keys.menu, queryFn: getRestaurantMenu, enabled, staleTime: 15_000 });
}

/** Deja en caché la cuenta que devolvió la API y marca el plano de mesas para recargar. */
export function useApplyCheck() {
  const client = useQueryClient();
  const keys = useRestaurantKeys();
  return (check: Check) => {
    client.setQueryData(keys.check(check.id), check);
    void client.invalidateQueries({ queryKey: keys.tables });
  };
}

export function useOpenCheck() {
  const apply = useApplyCheck();
  return useMutation({ mutationFn: openCheck, onSuccess: apply });
}

export function useCheckActions(checkId: number) {
  const apply = useApplyCheck();
  const client = useQueryClient();
  const keys = useRestaurantKeys();
  return {
    add: useMutation({
      mutationFn: (body: { product_id: number; quantity: number; note?: string }) => addItem(checkId, body),
      onSuccess: (check) => {
        apply(check);
        void client.invalidateQueries({ queryKey: keys.menu });
      },
    }),
    update: useMutation({
      mutationFn: ({ itemId, ...body }: { itemId: number; quantity?: number; note?: string }) =>
        updateItem(checkId, itemId, body),
      onSuccess: apply,
    }),
    remove: useMutation({ mutationFn: (itemId: number) => removeItem(checkId, itemId), onSuccess: apply }),
    deliver: useMutation({ mutationFn: (itemId: number) => deliverItem(checkId, itemId), onSuccess: apply }),
    cancelItem: useMutation({
      mutationFn: ({ itemId, reason }: { itemId: number; reason: string }) => cancelItem(checkId, itemId, reason),
      onSuccess: apply,
    }),
    cancelCheck: useMutation({ mutationFn: (reason?: string) => cancelCheck(checkId, reason), onSuccess: apply }),
    reassign: useMutation({ mutationFn: (waiterId: number) => reassignCheck(checkId, waiterId), onSuccess: apply }),
  };
}
