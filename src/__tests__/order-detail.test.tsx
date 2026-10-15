import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import OrderDetail from "../../app/(tabs)/ordenes/[id]";
import type { WorkOrder, WorkOrderAction } from "@/api/types";
import { setOutboxStore } from "@/outbox/queue";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { createMemoryStore } from "@/test/memory-outbox-store";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "5" }),
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
const mockPush = jest.fn();
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockUuid}` }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-image-manipulator", () => ({}));
jest.mock("expo-file-system", () => ({ Paths: {}, Directory: jest.fn(), File: jest.fn() }));

const fetchMock = mockFetch();

const order = (extra: Partial<WorkOrder> = {}, actions: WorkOrderAction[] = []): WorkOrder => ({
  id: 5,
  title: "Cambiar balatas",
  status: "in_progress",
  priority: "medium",
  progress: 50,
  items_count: 0,
  steps_count: 2,
  steps_done: 1,
  created_at: "2026-10-15T10:00:00Z",
  employee: { id: 1, name: "Sara" },
  steps: [
    { id: 1, description: "Quitar rueda", position: 1, done: true, done_by: { id: 1, name: "Sara" } },
    { id: 2, description: "Cambiar pastillas", position: 2, done: false },
  ],
  photos: [],
  events: [],
  allowed_actions: actions,
  ...extra,
});

beforeEach(async () => {
  mockUuid = 0;
  mockPush.mockReset();
  fetchMock.mockReset();
  await clearStore();
  await seedSession(staffUser, 10);
  setOutboxStore(createMemoryStore());
});

describe("detalle de la orden", () => {
  it("solo dibuja las acciones que manda la API", async () => {
    fetchMock.mockReturnValue(reply(200, order({ status: "open" }, ["start", "check_steps"])));
    await renderScreen(<OrderDetail />);

    expect(await screen.findByRole("button", { name: "Empezar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cobrar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Terminar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reabrir" })).toBeNull();
  });

  it("una orden sin acciones permitidas no muestra botones ni cajas de captura", async () => {
    fetchMock.mockReturnValue(reply(200, order({ status: "paid" }, [])));
    await renderScreen(<OrderDetail />);

    await screen.findByText("Cambiar balatas");
    expect(screen.queryByRole("button", { name: "Agregar nota" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cámara" })).toBeNull();
  });

  it("Cobrar lleva a la pantalla de cobro; bloqueado si no hay conceptos con precio", async () => {
    fetchMock.mockReturnValue(reply(200, order({ status: "done" }, ["charge", "reopen"])));
    const view = await renderScreen(<OrderDetail />);
    await fireEvent.press(await screen.findByRole("button", { name: "Cobrar" }));
    expect(mockPush).toHaveBeenCalledWith("/cobro/5");
    await view.unmount();

    fetchMock.mockReturnValue(reply(200, order({ status: "done", charge_blocked_reason: "no_items" }, ["charge"])));
    await renderScreen(<OrderDetail />);
    expect(await screen.findByText("Agrega conceptos con precio para poder cobrar.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cobrar" }).props.accessibilityState.disabled).toBe(true);
  });

  it("terminar con pasos pendientes pide confirmar", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    fetchMock.mockReturnValue(reply(200, order({}, ["finish", "check_steps"])));
    await renderScreen(<OrderDetail />);

    await fireEvent.press(await screen.findByRole("button", { name: "Terminar" }));

    expect(alert).toHaveBeenCalledWith("Hay pasos pendientes", "Faltan 1 pasos por marcar. ¿Terminar de todos modos?", expect.any(Array));
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/finish"))).toBe(false);
    alert.mockRestore();
  });

  it("marcar un paso llama a la API", async () => {
    fetchMock.mockImplementation((_url: string, init: { method: string }) =>
      reply(200, order({ steps_done: init.method === "PATCH" ? 2 : 1 }, ["check_steps"])),
    );
    await renderScreen(<OrderDetail />);

    await fireEvent.press(await screen.findByRole("checkbox", { name: "Cambiar pastillas" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([, init]) => init.method === "PATCH");
      expect(call?.[0]).toMatch(/\/work_orders\/5\/steps\/2$/);
      expect(JSON.parse(call?.[1].body)).toEqual({ done: true });
    });
  });

  it("una nota sin red queda como pendiente en la orden", async () => {
    fetchMock.mockImplementation((_url: string, init: { method: string }) =>
      init.method === "POST" ? Promise.reject(new TypeError("Network request failed")) : reply(200, order({}, ["add_note"])),
    );
    await renderScreen(<OrderDetail />);

    await fireEvent.changeText(await screen.findByTestId("note-input"), "Falta el cable");
    await fireEvent.press(screen.getByRole("button", { name: "Agregar nota" }));

    expect(await screen.findByText("Falta el cable")).toBeTruthy();
    expect(await screen.findByText("PENDIENTE DE ENVIAR")).toBeTruthy();
  });

  it("no deja agregar una nota vacía", async () => {
    fetchMock.mockReturnValue(reply(200, order({}, ["add_note"])));
    await renderScreen(<OrderDetail />);

    await fireEvent.press(await screen.findByRole("button", { name: "Agregar nota" }));

    expect(await screen.findByText("Escribe algo antes de agregar.")).toBeTruthy();
  });

  it("si la orden ya no es tuya (404) lo explica y ofrece volver", async () => {
    fetchMock.mockReturnValue(apiError(404));
    await renderScreen(<OrderDetail />);

    expect(await screen.findByText("Esta orden ya no está disponible para ti.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Volver a la lista" })).toBeTruthy();
  });

  it("avisa cuando otra persona cambió la orden y la acción es rechazada", async () => {
    fetchMock.mockImplementation((_url: string, init: { method: string }) =>
      init.method === "POST" ? apiError(422, "No se puede empezar") : reply(200, order({ status: "open" }, ["start"])),
    );
    await renderScreen(<OrderDetail />);

    await fireEvent.press(await screen.findByRole("button", { name: "Empezar" }));

    expect(await screen.findByTestId("order-conflict")).toBeTruthy();
  });
});
