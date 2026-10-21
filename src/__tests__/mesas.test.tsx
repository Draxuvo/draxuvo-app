import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import Mesas from "../../app/(tabs)/mesas";
import type { Check, TablesResponse } from "@/api/types";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const fetchMock = mockFetch();
const waiter = { id: 1, name: "Sara Staff" };
const tables = (extra: Partial<TablesResponse> = {}): TablesResponse => ({
  results: [
    {
      id: 1, name: "1", active: true, position: 1,
      check: { id: 31, waiter, opened_at: new Date().toISOString(), total: "155.00", counts: { new: 1, preparing: 0, ready: 2, delivered: 0 }, mine: true },
    },
    { id: 2, name: "2", active: true, position: 2, check: null },
  ],
  takeouts: [],
  ready_items: [],
  ...extra,
});

const check = (over: Partial<Check> = {}): Check => ({
  id: 77, status: "open", table: { id: 2, name: "2" }, takeout_name: null, waiter, opened_at: new Date().toISOString(),
  total: "0.00", paid: "0.00", balance: "0.00", items: [], payments: [], ticket_id: null, allowed_actions: ["add_item", "send", "pay"], ...over,
});
const draft = (id: number, name: string, quantity: number, price = "30.00") => ({
  id, name, quantity, unit_price: price, note: null, status: "draft" as const, station: null, kitchen_order_number: null,
  sent_at: null, ready_at: null, allowed_actions: [],
});

const menu = { menu: [{ category: "Antojitos", items: [{ id: 7, name: "Tostada", price: 30 }, { id: 8, name: "Sope", price: 25, sold_out: true }] }] };

/** Contesta cada ruta; `routes` ajusta lo que cambia en una prueba. */
function serve(routes: Record<string, unknown> = {}) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const method = init?.method ?? "GET";
    const key = `${method} ${new URL(url).pathname}`;
    if (key in routes) {
      const value = routes[key];
      return typeof value === "function" ? (value as () => unknown)() : reply(200, value);
    }
    if (key === "GET /api/v1/restaurant/tables") return reply(200, tables());
    if (key === "GET /api/v1/products/menu") return reply(200, menu);
    return reply(404, { error: { status: 404, message: "x" } });
  });
}

const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

beforeEach(async () => {
  fetchMock.mockReset();
  mockPush.mockReset();
  await clearStore();
  await seedSession(staffUser, 10);
});

describe("mesas (pantalla de tomar pedido)", () => {
  it("pinta las mesas con su estado en texto y el total de las ocupadas", async () => {
    serve();
    await renderScreen(<Mesas />);

    expect(await screen.findByRole("button", { name: "1, Ocupada, $155.00" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2, Libre" })).toBeTruthy();
  });

  it("muestra la orden de una mesa ocupada en la misma pantalla, sin navegar", async () => {
    serve({ "GET /api/v1/restaurant/checks/31": check({ id: 31, table: { id: 1, name: "1" }, total: "0.00", items: [draft(1, "Tostada", 2)] }) });
    await renderScreen(<Mesas />);

    await fireEvent.press(await screen.findByRole("button", { name: "1, Ocupada, $155.00" }));

    expect(await screen.findByText("Tostada")).toBeTruthy();
    expect(screen.getByLabelText("Total $60.00")).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("abre una cuenta nueva al tocar una mesa libre y pasa al menú", async () => {
    serve({ "POST /api/v1/restaurant/checks": () => reply(201, check()), "GET /api/v1/restaurant/checks/77": check() });
    await renderScreen(<Mesas />);

    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));

    await waitFor(() => expect(JSON.parse(posts()[0][1].body)).toEqual({ dining_table_id: 2 }));
    expect(await screen.findByRole("button", { name: /^Tostada, \$30.00/ })).toBeTruthy();
  });

  it("agrega un producto al tocar su tarjeta y no deja tocar lo agotado", async () => {
    serve({
      "POST /api/v1/restaurant/checks": () => reply(201, check()),
      "GET /api/v1/restaurant/checks/77": check(),
      "POST /api/v1/restaurant/checks/77/items": () => reply(201, check({ total: "0.00", items: [draft(5, "Tostada", 1)] })),
    });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));

    await fireEvent.press(await screen.findByRole("button", { name: /^Tostada, \$30.00/ }));

    await waitFor(() => expect(posts().some(([url]) => String(url).endsWith("/checks/77/items"))).toBe(true));
    const add = posts().find(([url]) => String(url).endsWith("/checks/77/items"))!;
    expect(JSON.parse(add[1].body)).toEqual({ product_id: 7, quantity: 1 });
    expect(await screen.findByRole("button", { name: /^Tostada, \$30.00.*1 en la orden/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Sope.*Agotado/ }).props.accessibilityState.disabled).toBe(true);
  });

  it("avisa cuando la mesa ya está ocupada", async () => {
    serve({ "POST /api/v1/restaurant/checks": () => apiError(422, { code: "table_occupied" }, "ocupada") });
    await renderScreen(<Mesas />);

    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));

    expect(await screen.findByText("La mesa ya tiene una cuenta abierta")).toBeTruthy();
  });

  it("abre una cuenta para llevar con el nombre del cliente", async () => {
    serve({ "POST /api/v1/restaurant/checks": () => reply(201, check({ id: 90, table: null, takeout_name: "Luis" })), "GET /api/v1/restaurant/checks/90": check({ id: 90 }) });
    await renderScreen(<Mesas />);
    await screen.findByRole("button", { name: "2, Libre" });

    await fireEvent.changeText(screen.getByLabelText("Nombre del cliente (para llevar)"), "Luis");
    await fireEvent.press(screen.getByRole("button", { name: "Nuevo para llevar" }));

    await waitFor(() => expect(JSON.parse(posts()[0][1].body)).toEqual({ takeout_name: "Luis" }));
  });

  it("muestra las alertas de inventario solo a encargados", async () => {
    serve({ "GET /api/v1/restaurant/tables": tables({ stock_alerts: 2 }) });
    await renderScreen(<Mesas />);
    await screen.findByRole("button", { name: "2, Libre" });
    expect(screen.queryByTestId("stock-alerts")).toBeNull();
  });

  it("sin mesas muestra el estado vacío", async () => {
    serve({ "GET /api/v1/restaurant/tables": tables({ results: [] }) });
    await renderScreen(<Mesas />);

    expect(await screen.findByText("Aún no hay mesas")).toBeTruthy();
  });
});
