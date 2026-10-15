import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { sqliteStore, type OutboxItem, type OutboxScope, type OutboxStore } from "./db";

let store: OutboxStore = sqliteStore;
const listeners = new Set<() => void>();

/** Solo para pruebas: cambia el almacén. */
export function setOutboxStore(next: OutboxStore) {
  store = next;
}

export function getOutboxStore(): OutboxStore {
  return store;
}

export function subscribeOutbox(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function notifyOutbox() {
  listeners.forEach((listener) => listener());
}

export interface OutboxContext {
  companyId: number;
  userId: number;
}

export interface QueuedPhoto {
  uri: string;
  name: string;
  type: string;
}

/** La foto se copia a una carpeta propia: la caché del teléfono se puede limpiar antes de que haya red. */
function keepFile(uri: string, id: string, name: string): string {
  const dir = new Directory(Paths.document, "outbox");
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${id}-${name}`);
  new File(uri).copy(target, { overwrite: true });
  return target.uri;
}

export function deleteKeptFile(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Si ya no está, no hay nada que borrar.
  }
}

function base(ctx: OutboxContext, orderId: number, kind: OutboxItem["kind"]): OutboxItem {
  return {
    id: Crypto.randomUUID(),
    companyId: ctx.companyId,
    userId: ctx.userId,
    orderId,
    kind,
    text: null,
    fileUri: null,
    fileName: null,
    fileType: null,
    description: null,
    state: "pending",
    error: null,
    attempts: 0,
    createdAt: Date.now(),
  };
}

/** Primero se guarda en el teléfono; el envío viene después (FR-023). */
export async function enqueueNote(ctx: OutboxContext, orderId: number, text: string): Promise<OutboxItem> {
  const item = { ...base(ctx, orderId, "note"), text: text.trim() };
  await store.insert(item);
  notifyOutbox();
  return item;
}

export async function enqueuePhoto(ctx: OutboxContext, orderId: number, photo: QueuedPhoto, description?: string): Promise<OutboxItem> {
  const draft = base(ctx, orderId, "photo");
  const item: OutboxItem = {
    ...draft,
    fileUri: keepFile(photo.uri, draft.id, photo.name),
    fileName: photo.name,
    fileType: photo.type,
    description: description?.trim() || null,
  };
  await store.insert(item);
  notifyOutbox();
  return item;
}

export const listOutbox = (scope: OutboxScope) => store.list(scope);

/** Reintenta uno que falló: vuelve a pendiente con el mismo UUID. */
export async function retryItem(id: string) {
  await store.update(id, { state: "pending", error: null });
  notifyOutbox();
}

/** La persona decide descartar un pendiente que ya no se puede enviar. */
export async function discardItem(id: string) {
  const item = await store.get(id);
  await store.remove(id);
  deleteKeptFile(item?.fileUri ?? null);
  notifyOutbox();
}
