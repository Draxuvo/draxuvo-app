import type { OutboxItem, OutboxScope, OutboxStore } from "@/outbox/db";

/** Almacén en memoria con la misma interfaz que SQLite, para probar la cola sin teléfono. */
export function createMemoryStore(): OutboxStore & { all: () => OutboxItem[] } {
  const rows = new Map<string, OutboxItem>();
  const inScope = (item: OutboxItem, scope: OutboxScope) =>
    item.companyId === scope.companyId && item.userId === scope.userId && (scope.orderId == null || item.orderId === scope.orderId);
  return {
    all: () => [...rows.values()],
    insert: async (item) => void rows.set(item.id, { ...item }),
    update: async (id, patch) => {
      const current = rows.get(id);
      if (current) rows.set(id, { ...current, ...patch });
    },
    remove: async (id) => void rows.delete(id),
    get: async (id) => rows.get(id) ?? null,
    list: async (scope) => [...rows.values()].filter((item) => inScope(item, scope)).sort((a, b) => a.createdAt - b.createdAt),
    resetSending: async (scope) => {
      rows.forEach((item, id) => {
        if (inScope(item, scope) && item.state === "sending") rows.set(id, { ...item, state: "pending" });
      });
    },
  };
}
