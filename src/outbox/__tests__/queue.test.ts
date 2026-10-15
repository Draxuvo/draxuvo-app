import { apiError, mockFetch, reply } from "@/test/helpers";
import { discardItem, enqueueNote, enqueuePhoto, listOutbox, retryItem, setOutboxStore } from "../queue";
import { flushOutbox, MAX_ATTEMPTS } from "../sender";
import { createMemoryStore } from "@/test/memory-outbox-store";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
let mockCounter = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockCounter}` }));
const mockDelete = jest.fn();
const mockCopy = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { document: "doc" },
  Directory: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
  File: jest.fn().mockImplementation((...args: unknown[]) => ({
    uri: typeof args[0] === "string" ? args[0] : `file:///kept/${String(args[1])}`,
    exists: true,
    copy: mockCopy,
    delete: mockDelete,
  })),
}));

const fetchMock = mockFetch();
const ctx = { companyId: 10, userId: 1 };
const order = { id: 5, title: "x" };
let store = createMemoryStore();

beforeEach(() => {
  mockCounter = 0;
  fetchMock.mockReset();
  mockDelete.mockReset();
  mockCopy.mockReset();
  store = createMemoryStore();
  setOutboxStore(store);
});

const keys = () => fetchMock.mock.calls.map(([, init]) => init.headers["Idempotency-Key"]);

describe("cola sin red", () => {
  it("guarda primero en el teléfono, como pendiente y con su UUID", async () => {
    const item = await enqueueNote(ctx, 5, "  Falta el cable ");
    expect(item).toMatchObject({ id: "uuid-1", state: "pending", text: "Falta el cable", kind: "note" });
    expect(await listOutbox(ctx)).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envía con la llave de idempotencia y borra lo enviado", async () => {
    await enqueueNote(ctx, 5, "hola");
    fetchMock.mockReturnValue(reply(201, order));
    const onSent = jest.fn();

    expect(await flushOutbox(ctx, onSent)).toBe(1);

    expect(keys()).toEqual(["uuid-1"]);
    expect(onSent).toHaveBeenCalledWith(order, expect.objectContaining({ id: "uuid-1" }));
    expect(store.all()).toHaveLength(0);
  });

  it("sin red queda pendiente y al volver se reenvía con la MISMA llave, sin duplicar", async () => {
    await enqueueNote(ctx, 5, "hola");
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
    expect(await flushOutbox(ctx)).toBe(0);
    expect(store.all()[0]).toMatchObject({ state: "pending", attempts: 0 });

    fetchMock.mockReturnValue(reply(201, order));
    expect(await flushOutbox(ctx)).toBe(1);

    expect(keys()).toEqual(["uuid-1", "uuid-1"]);
    expect(store.all()).toHaveLength(0);
  });

  it("si la app se cerró a mitad de un envío, lo que quedó 'sending' se reenvía", async () => {
    const item = await enqueueNote(ctx, 5, "hola");
    await store.update(item.id, { state: "sending" });
    fetchMock.mockReturnValue(reply(201, order));

    expect(await flushOutbox(ctx)).toBe(1);
    expect(keys()).toEqual(["uuid-1"]);
  });

  it("envía en el orden en que se hicieron", async () => {
    await enqueueNote(ctx, 5, "uno");
    await enqueueNote(ctx, 5, "dos");
    fetchMock.mockReturnValue(reply(201, order));
    await flushOutbox(ctx);
    expect(keys()).toEqual(["uuid-1", "uuid-2"]);
  });

  it("404 y 403 pasan a descartable y los demás pendientes siguen", async () => {
    await enqueueNote(ctx, 5, "gone");
    await enqueueNote(ctx, 6, "forbidden");
    await enqueueNote(ctx, 7, "ok");
    fetchMock
      .mockReturnValueOnce(apiError(404))
      .mockReturnValueOnce(apiError(403))
      .mockReturnValueOnce(reply(201, order));

    expect(await flushOutbox(ctx)).toBe(1);

    expect(store.all().map((item) => item.state)).toEqual(["discardable", "discardable"]);
  });

  it("descartar quita el pendiente y su foto guardada", async () => {
    const photo = await enqueuePhoto(ctx, 5, { uri: "file:///cache/a.jpg", name: "a.jpg", type: "image/jpeg" });
    expect(mockCopy).toHaveBeenCalled();
    await discardItem(photo.id);
    expect(store.all()).toHaveLength(0);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("un rechazo 422 queda 'failed' y reintentar lo devuelve a pendiente", async () => {
    await enqueueNote(ctx, 5, "x");
    fetchMock.mockReturnValue(apiError(422, null, "inválido"));
    await flushOutbox(ctx);
    expect(store.all()[0]).toMatchObject({ state: "failed", error: "inválido" });

    await retryItem("uuid-1");
    expect(store.all()[0]).toMatchObject({ state: "pending", error: null });
  });

  it("tras varios fallos del servidor deja de insistir", async () => {
    await enqueueNote(ctx, 5, "x");
    fetchMock.mockReturnValue(apiError(500));
    for (let i = 0; i < MAX_ATTEMPTS; i++) await flushOutbox(ctx);
    expect(store.all()[0].state).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("una empresa no mezcla pendientes con otra", async () => {
    await enqueueNote(ctx, 5, "de Volta");
    await enqueueNote({ companyId: 20, userId: 1 }, 9, "de Sazón");
    fetchMock.mockReturnValue(reply(201, order));

    await flushOutbox({ companyId: 20, userId: 1 });

    expect(keys()).toEqual(["uuid-2"]);
    expect(store.all().map((item) => item.companyId)).toEqual([10]);
  });

  it("dos disparos a la vez comparten un solo envío", async () => {
    await enqueueNote(ctx, 5, "x");
    fetchMock.mockReturnValue(reply(201, order));
    await Promise.all([flushOutbox(ctx), flushOutbox(ctx)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("una foto enviada borra su copia guardada", async () => {
    await enqueuePhoto(ctx, 5, { uri: "file:///cache/a.jpg", name: "a.jpg", type: "image/jpeg" }, "detalle");
    fetchMock.mockReturnValue(reply(201, order));
    await flushOutbox(ctx);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/work_orders\/5\/photos$/);
    expect(mockDelete).toHaveBeenCalled();
  });
});
