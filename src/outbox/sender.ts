import { ApiError, NetworkError } from "@/api/client";
import { postNote, postPhoto } from "@/api/orders";
import type { WorkOrder } from "@/api/types";
import { deleteKeptFile, getOutboxStore, notifyOutbox, type OutboxContext } from "./queue";
import type { OutboxItem } from "./db";

/** Fallos del servidor seguidos antes de pasar un pendiente a "failed". */
export const MAX_ATTEMPTS = 5;

let running: Promise<number> | null = null;

async function send(item: OutboxItem): Promise<WorkOrder> {
  if (item.kind === "note") return postNote(item.orderId, item.text ?? "", item.id);
  return postPhoto(item.orderId, { uri: item.fileUri ?? "", name: item.fileName ?? "foto.jpg", type: item.fileType ?? "image/jpeg" }, item.description ?? undefined, item.id);
}

/**
 * Envía los pendientes de la empresa activa, en orden y uno a la vez. Devuelve cuántos llegaron.
 * Dos llamadas seguidas comparten la misma corrida: nunca hay dos envíos del mismo pendiente a la vez.
 */
export function flushOutbox(ctx: OutboxContext, onSent?: (order: WorkOrder, item: OutboxItem) => void): Promise<number> {
  running ??= run(ctx, onSent).finally(() => {
    running = null;
  });
  return running;
}

async function run(ctx: OutboxContext, onSent?: (order: WorkOrder, item: OutboxItem) => void): Promise<number> {
  const store = getOutboxStore();
  await store.resetSending(ctx);
  const items = (await store.list(ctx)).filter((item) => item.state === "pending");
  let delivered = 0;

  for (const item of items) {
    await store.update(item.id, { state: "sending" });
    notifyOutbox();
    try {
      const order = await send(item);
      await store.remove(item.id);
      deleteKeptFile(item.fileUri);
      delivered += 1;
      onSent?.(order, item);
      notifyOutbox();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
        // La orden ya no existe o dejó de ser de la persona: no tiene caso reintentar (FR-023).
        await store.update(item.id, { state: "discardable", error: String(error.status) });
        notifyOutbox();
        continue;
      }
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 408 && error.status !== 429) {
        await store.update(item.id, { state: "failed", error: error.message });
        notifyOutbox();
        continue;
      }
      // Sin red, sesión vencida o fallo del servidor: vuelve a pendiente y se deja de insistir por ahora.
      const attempts = item.attempts + (error instanceof NetworkError ? 0 : 1);
      const exhausted = attempts >= MAX_ATTEMPTS;
      await store.update(item.id, {
        state: exhausted ? "failed" : "pending",
        attempts,
        error: exhausted && error instanceof Error ? error.message : null,
      });
      notifyOutbox();
      if (!exhausted) break;
    }
  }
  return delivered;
}
