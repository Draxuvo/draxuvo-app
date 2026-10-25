import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import OrdersList from "../../app/(tabs)/ordenes/index";
import type { TablesResponse, WorkOrder } from "@/api/types";
import { apiError, clearStore, mockFetch, multiUser, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => true }));

const fetchMock = mockFetch();

const order = (id: number, title: string, status: WorkOrder["status"]): WorkOrder => ({
  id, title, status, priority: "medium", progress: 0, items_count: 0, steps_count: 2, steps_done: 1, created_at: "2026-10-15T10:00:00Z",
  employee: { id: 1, name: "Sara" },
});

const page = (results: WorkOrder[]) => reply(200, { info: { page_size: 20, page_index: 1, total: results.length, page_start: 1, page_end: results.length }, results });

const counts = { new: 0, preparing: 0, ready: 0, delivered: 0 };
const tables = (extra: Partial<TablesResponse> = {}): TablesResponse => ({
  results: [
    { id: 1, name: "1", active: true, position: 1, check: { id: 31, waiter: { id: 1, name: "Sara Staff" }, opened_at: new Date().toISOString(), total: "155.00", counts, mine: true } },
    { id: 2, name: "2", active: true, position: 2, check: { id: 32, waiter: { id: 2, name: "Luis" }, opened_at: new Date().toISOString(), total: "80.00", counts, mine: false } },
    { id: 3, name: "3", active: true, position: 3, check: null },
  ],
  takeouts: [{ id: 33, takeout_name: "Mario", waiter: { id: 1, name: "Sara Staff" }, opened_at: new Date().toISOString(), total: "20.00", counts, mine: true }],
  ready_items: [],
  ...extra,
});

/** Responde según el `status` pedido (cada pestaña recibe solo lo suyo) y, si se da, el plano de mesas. */
function serve(byStatus: Record<string, WorkOrder[]>, restaurant?: TablesResponse) {
  fetchMock.mockImplementation((url: string) => {
    if (url.includes("/employees")) return page([]);
    if (url.includes("/restaurant/tables")) {
      return restaurant ? reply(200, restaurant) : apiError(403, { code: "module_not_in_plan" }, "sin módulo");
    }
    const status = new URL(url).searchParams.get("status") ?? "";
    return page(byStatus[status] ?? []);
  });
}

const listCalls = () => fetchMock.mock.calls.map(([url]) => new URL(url as string)).filter((u) => u.pathname === "/api/v1/work_orders");

beforeEach(async () => {
  fetchMock.mockReset();
  mockPush.mockReset();
  await clearStore();
});

describe("lista de órdenes por estado", () => {
  it("muestra pestañas con contador y cada una lista solo su estado", async () => {
    await seedSession(staffUser, 10);
    serve({ open: [order(2, "Revisar luces", "open")], in_progress: [order(1, "Cambiar balatas", "in_progress"), order(4, "Pulir", "in_progress")], done: [order(3, "Alinear", "done")] });
    await renderScreen(<OrdersList />);

    // Sin restaurante abre en Pendientes.
    expect(await screen.findByText("Revisar luces")).toBeTruthy();
    expect(screen.queryByText("Cambiar balatas")).toBeNull();
    expect(await screen.findByRole("tab", { name: "En curso, 2" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Pendientes, 1" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Terminadas, 1" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Cobradas, 0" })).toBeTruthy();

    await fireEvent.press(screen.getByRole("tab", { name: "En curso, 2" }));
    expect(await screen.findByText("Cambiar balatas")).toBeTruthy();
    expect(screen.queryByText("Revisar luces")).toBeNull();

    await fireEvent.press(screen.getByRole("tab", { name: "Terminadas, 1" }));
    expect(await screen.findByText("Alinear")).toBeTruthy();
  });

  it("Cobradas pide solo las de hoy", async () => {
    await seedSession(staffUser, 10);
    serve({ paid: [order(5, "Frenos", "paid")] });
    await renderScreen(<OrdersList />);

    await fireEvent.press(await screen.findByRole("tab", { name: /^Cobradas/ }));

    expect(await screen.findByText("Frenos")).toBeTruthy();
    await waitFor(() => expect(listCalls().some((u) => u.searchParams.get("status") === "paid" && /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get("paid_on") ?? ""))).toBe(true));
  });

  it("Canceladas es un filtro aparte: ninguna pestaña queda seleccionada", async () => {
    await seedSession(staffUser, 10);
    serve({ open: [order(2, "Revisar luces", "open")], cancelled: [order(6, "Instalación cancelada", "cancelled")] });
    await renderScreen(<OrdersList />);
    await screen.findByText("Revisar luces");

    await fireEvent.press(screen.getByRole("button", { name: "Canceladas" }));

    expect(await screen.findByText("Instalación cancelada")).toBeTruthy();
    expect(screen.queryByText("Revisar luces")).toBeNull();
    expect(screen.getByRole("tab", { name: /^Pendientes/ }).props.accessibilityState.selected).toBe(false);

    await fireEvent.press(screen.getByRole("tab", { name: /^Pendientes/ }));
    expect(await screen.findByText("Revisar luces")).toBeTruthy();
  });

  it("cada estado sin órdenes muestra su propio vacío", async () => {
    await seedSession(staffUser, 10);
    serve({});
    await renderScreen(<OrdersList />);

    expect(await screen.findByText("No hay órdenes pendientes")).toBeTruthy();
    await fireEvent.press(screen.getByRole("tab", { name: /^Terminadas/ }));
    expect(await screen.findByText("No hay órdenes terminadas")).toBeTruthy();
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

  it("el staff no ve el filtro por responsable; el dueño sí", async () => {
    await seedSession(staffUser, 10);
    serve({});
    const staff = await renderScreen(<OrdersList />);
    await screen.findByText("No hay órdenes pendientes");
    expect(screen.queryByRole("button", { name: "Todas" })).toBeNull();
    await staff.unmount();

    fetchMock.mockImplementation((url: string) => (url.includes("/employees") ? page([{ id: 1, name: "Sara" } as never]) : page([])));
    await seedSession(multiUser, 10);
    await renderScreen(<OrdersList />);
    expect(await screen.findByRole("button", { name: "Sara" })).toBeTruthy();
  });
});

describe("Órdenes con mesas (spec 023)", () => {
  it("abre en En curso y el operador ve solo las cuentas que atiende, antes de las órdenes", async () => {
    await seedSession(staffUser, 10);
    serve({ in_progress: [order(1, "Cambiar balatas", "in_progress")] }, tables());
    await renderScreen(<OrdersList />);

    expect(await screen.findByRole("button", { name: "Abrir cuenta de 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir cuenta de Mario" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abrir cuenta de 2" })).toBeNull();
    expect(await screen.findByText("Cambiar balatas")).toBeTruthy();
    // En curso suma las cuentas propias (2) a las órdenes (1).
    expect(await screen.findByRole("tab", { name: "En curso, 3" })).toBeTruthy();
  });

  it("la administración ve todas las cuentas y las alertas de existencias", async () => {
    await seedSession(multiUser, 10);
    serve({}, tables({ stock_alerts: 2 }));
    await renderScreen(<OrdersList />);

    expect(await screen.findByRole("button", { name: "Abrir cuenta de 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir cuenta de 1" })).toBeTruthy();
    expect(await screen.findByTestId("stock-alerts")).toBeTruthy();
  });

  it("no repite la palabra Mesa cuando la mesa ya se llama así", async () => {
    await seedSession(staffUser, 10);
    const named = tables();
    named.results[0].name = "Mesa 1";
    serve({}, named);
    await renderScreen(<OrdersList />);

    await screen.findByRole("button", { name: "Abrir cuenta de Mesa 1" });
    expect(screen.getByText("Mesa 1")).toBeTruthy();
    expect(screen.queryByText("Mesa Mesa 1")).toBeNull();
  });

  it("tocar una cuenta abre Tomar pedido con esa cuenta", async () => {
    await seedSession(staffUser, 10);
    serve({}, tables());
    await renderScreen(<OrdersList />);

    await fireEvent.press(await screen.findByRole("button", { name: "Abrir cuenta de 1" }));

    expect(mockPush).toHaveBeenCalledWith("/pedido?cuenta=31");
  });

  it("las cuentas no salen en las demás pestañas", async () => {
    await seedSession(staffUser, 10);
    serve({ open: [order(2, "Revisar luces", "open")] }, tables());
    await renderScreen(<OrdersList />);
    await screen.findByRole("button", { name: "Abrir cuenta de 1" });

    await fireEvent.press(screen.getByRole("tab", { name: /^Pendientes/ }));

    expect(await screen.findByText("Revisar luces")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abrir cuenta de 1" })).toBeNull();
  });
});

describe("Cuentas cobradas hoy en Cobradas", () => {
  const closed_today = [
    { id: 40, name: "2", takeout_name: null, closed_at: new Date().toISOString(), ticket_id: 7, waiter: { id: 1, name: "Sara Staff" }, total: "380.00", mine: true },
    { id: 41, name: null, takeout_name: "Eva", closed_at: new Date().toISOString(), ticket_id: 8, mine: false },
  ];

  it("el operador ve en Cobradas solo las suyas y suma al contador", async () => {
    await seedSession(staffUser, 10);
    serve({}, tables({ closed_today }));
    await renderScreen(<OrdersList />);

    await fireEvent.press(await screen.findByRole("tab", { name: /^Cobradas/ }));

    expect(await screen.findByRole("button", { name: "Ver cuenta cobrada de 2" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver cuenta cobrada de Eva" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Cobradas, 1" })).toBeTruthy();
  });

  it("la administración ve todas y tocar una abre su hoja con el ticket", async () => {
    await seedSession(multiUser, 10);
    serve({}, tables({ closed_today }));
    await renderScreen(<OrdersList />);
    await fireEvent.press(await screen.findByRole("tab", { name: /^Cobradas/ }));

    expect(await screen.findByRole("button", { name: "Ver cuenta cobrada de Eva" })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Ver cuenta cobrada de 2" }));

    expect(mockPush).toHaveBeenCalledWith("/pedido?cuenta=40&hoja=1");
  });

  it("el responsable elegido recorta las cuentas cobradas y las abiertas por su mesero", async () => {
    await seedSession(multiUser, 10);
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/employees")) return reply(200, { info: { page_size: 20, page_index: 1, total: 1, page_start: 1, page_end: 1 }, results: [{ id: 5, user_id: 1, name: "Sara Staff" }] });
      if (url.includes("/restaurant/tables")) return reply(200, tables({ closed_today }));
      return page([]);
    });
    await renderScreen(<OrdersList />);
    await fireEvent.press(await screen.findByRole("button", { name: "Sara Staff" }));

    // Sara (usuario 1) atiende la mesa 1 y cobró la 2; Luis atiende la 2 abierta.
    expect(await screen.findByRole("button", { name: "Abrir cuenta de 1" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abrir cuenta de 2" })).toBeNull();
    await fireEvent.press(screen.getByRole("tab", { name: /^Cobradas/ }));
    expect(await screen.findByRole("button", { name: "Ver cuenta cobrada de 2" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver cuenta cobrada de Eva" })).toBeNull();
  });

  it("no salen en En curso", async () => {
    await seedSession(multiUser, 10);
    serve({}, tables({ closed_today }));
    await renderScreen(<OrdersList />);

    await screen.findByRole("button", { name: "Abrir cuenta de 1" });
    expect(screen.queryByRole("button", { name: "Ver cuenta cobrada de 2" })).toBeNull();
  });
});

describe("botón de nueva orden", () => {
  it("con mesas abre Tomar pedido", async () => {
    await seedSession(staffUser, 10);
    serve({}, tables());
    await renderScreen(<OrdersList />);
    await screen.findByRole("button", { name: "Abrir cuenta de 1" });

    await fireEvent.press(screen.getByRole("button", { name: "Nueva cuenta" }));

    expect(mockPush).toHaveBeenCalledWith("/pedido");
  });

  it("con mesas la lista se llama Cuentas y marca las que están por cobrar (spec 032)", async () => {
    await seedSession(staffUser, 10);
    serve({}, tables({ takeouts: [{ id: 33, takeout_name: "Mario", waiter: { id: 1, name: "Sara Staff" }, opened_at: new Date().toISOString(), total: "20.00", counts: { new: 0, preparing: 0, ready: 0, delivered: 1 }, mine: true }] }));
    await renderScreen(<OrdersList />);

    expect(await screen.findByRole("button", { name: "Abrir cuenta de Mario" })).toBeTruthy();
    expect(screen.getByText(/Por cobrar · /)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nueva cuenta" })).toBeTruthy();
  });

  it("una cuenta ajena sin total no muestra dinero", async () => {
    await seedSession(multiUser, 10);
    serve({}, tables({ results: [{ id: 2, name: "2", active: true, position: 2, state: "occupied", check: { id: 32, opened_at: new Date().toISOString(), counts, mine: false } }], takeouts: [] }));
    await renderScreen(<OrdersList />);

    await screen.findByRole("button", { name: "Abrir cuenta de 2" });
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it("en modo servicio sin mesas abre el formulario de siempre", async () => {
    await seedSession(staffUser, 10);
    serve({});
    await renderScreen(<OrdersList />);
    await screen.findByText("No hay órdenes pendientes");

    await fireEvent.press(screen.getByRole("button", { name: "Nueva orden" }));

    expect(mockPush).toHaveBeenCalledWith("/orden-form/nueva");
  });
});
