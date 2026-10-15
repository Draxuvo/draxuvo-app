import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useApplyOrder } from "@/hooks/use-orders";
import type { OutboxItem } from "@/outbox/db";
import { discardItem, enqueueNote, enqueuePhoto, listOutbox, retryItem, subscribeOutbox, type QueuedPhoto } from "@/outbox/queue";
import { flushOutbox } from "@/outbox/sender";
import { useSession } from "@/session";

/** Pendientes de la persona en la empresa activa (opcionalmente de una sola orden). */
export function useOutbox(orderId?: number): OutboxItem[] {
  const { companyId, user } = useSession();
  const userId = user?.id;
  const [items, setItems] = useState<OutboxItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const reload = async () => {
      const next = companyId != null && userId != null ? await listOutbox({ companyId, userId, orderId }) : [];
      if (!cancelled) setItems(next);
    };
    void reload();
    const unsubscribe = subscribeOutbox(() => void reload());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [companyId, userId, orderId]);

  return items;
}

/** Guarda en la cola y envía de inmediato si hay red (FR-023). */
export function useOutboxActions() {
  const { companyId, user } = useSession();
  const apply = useApplyOrder();
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });

  const flush = useCallback(async () => {
    if (companyId == null || !user) return 0;
    return flushOutbox({ companyId, userId: user.id }, (order) => applyRef.current(order));
  }, [companyId, user]);

  const ctx = companyId != null && user ? { companyId, userId: user.id } : null;

  return {
    flush,
    addNote: async (orderId: number, text: string) => {
      if (!ctx) return;
      await enqueueNote(ctx, orderId, text);
      void flush();
    },
    addPhoto: async (orderId: number, photo: QueuedPhoto, description?: string) => {
      if (!ctx) return;
      await enqueuePhoto(ctx, orderId, photo, description);
      void flush();
    },
    retry: async (id: string) => {
      await retryItem(id);
      void flush();
    },
    discard: discardItem,
  };
}

/** Se monta una vez: reintenta al abrir, al volver la red y al regresar a la app. */
export function useOutboxSync() {
  const { flush } = useOutboxActions();
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });

  useEffect(() => {
    void flushRef.current();
    const net = NetInfo.addEventListener((state) => {
      if (state.isConnected) void flushRef.current();
    });
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void flushRef.current();
    });
    return () => {
      net();
      app.remove();
    };
  }, []);
}
