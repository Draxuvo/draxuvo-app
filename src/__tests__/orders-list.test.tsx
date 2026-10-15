import { fireEvent, screen } from "@testing-library/react-native";
import OrdersList from "../../app/(tabs)/ordenes/index";
import type { WorkOrder } from "@/api/types";
import { apiError, clearStore, mockFetch, multiUser, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const fetchMock = mockFetch();

const order = (id: number, title: string, status: WorkOrder["status"]): WorkOrder => ({
  id, title, status, priority: "medium", progress: 0, items_count: 0, steps_count: 2, steps_done: 1, created_at: "2026-10-15T10:00:00Z",
  employee: { id: 1, name: "Sara" },
});

const page = (results: WorkOrder[]) => reply(200, { info: { page_size: 20, page_index: 1, total: results.length, page_start: 1, page_end: results.length }, results });

/** Responde según el `status` pedido, para que cada pestaña reciba solo lo suyo. */
function serve(byStatus: Record<string, WorkOrder[]>) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/employees")) return page([]);
    const status = new URL(url).searchParams.get("status") ?? "";
    return page(byStatus[status] ?? []);
  });
}

beforeEach(async () => {
  fetchMock.mockReset();
  await clearStore();
});

describe("lista de órdenes", () => {
  it("separa lo que toca hacer de lo terminado", async () => {
    await seedSession(staffUser, 10);
    serve({ in_progress: [order(1, "Cambiar balatas", "in_progress")], open: [order(2, "Revisar luces", "open")], done: [order(3, "Alinear", "done")] });
    await renderScreen(<OrdersList />);

    expect(await screen.findByText("Cambiar balatas")).toBeTruthy();
    expect(screen.getByText("Revisar luces")).toBeTruthy();
    expect(screen.queryByText("Alinear")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Terminadas" }));
    expect(await screen.findByText("Alinear")).toBeTruthy();
  });

  it("sin órdenes por hacer muestra el estado vacío", async () => {
    await seedSession(staffUser, 10);
    serve({});
    await renderScreen(<OrdersList />);

    expect(await screen.findByText("No tienes órdenes por hacer.")).toBeTruthy();
  });

  it("si la lista falla ofrece reintentar", async () => {
    await seedSession(staffUser, 10);
    fetchMock.mockReturnValue(apiError(500, null, "boom"));
    await renderScreen(<OrdersList />);

    expect(await screen.findByText("Algo salió mal. Intenta de nuevo.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("sin red lo dice con claridad", async () => {
    await seedSession(staffUser, 10);
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await renderScreen(<OrdersList />);

    expect(await screen.findByText("Sin conexión. Revisa tu red e intenta de nuevo.")).toBeTruthy();
  });

  it("el staff no ve filtros; el dueño sí (FR-024)", async () => {
    await seedSession(staffUser, 10);
    serve({});
    const staff = await renderScreen(<OrdersList />);
    await screen.findByText("No tienes órdenes por hacer.");
    expect(screen.queryByRole("button", { name: "Abierta" })).toBeNull();
    staff.unmount();

    await seedSession(multiUser, 10);
    await renderScreen(<OrdersList />);
    expect(await screen.findByRole("button", { name: "Abierta" })).toBeTruthy();
  });
});
