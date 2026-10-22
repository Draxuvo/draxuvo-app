import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import Pedido from "../../app/pedido";
import type { Check, User, WorkOrder } from "@/api/types";
import { clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
  Redirect: () => null,
}));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockUuid}` }));

const Mesas = Pedido;
const fetchMock = mockFetch();
const orderUser: User = {
  ...staffUser,
  companies: [{ id: 10, name: "Aroma", slug: "aroma", role: "staff", parent_company_id: null, order_mode: "order" }],
};

const order = (over: Partial<WorkOrder> = {}): WorkOrder => ({
  id: 5, title: "Mesa 3", priority: "medium", status: "open", progress: 0, items_count: 0, steps_count: 0, steps_done: 0,
  created_at: "2026-10-20T10:00:00Z", total: 0, items: [], allowed_actions: ["finish", "edit"], ...over,
});
const menu = { menu: [{ category: "Bebidas", items: [{ id: 7, name: "Café", price: 20 }] }] };

function serve(routes: Record<string, unknown> = {}) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
    if (key in routes) {
      const value = routes[key];
      return typeof value === "function" ? (value as () => unknown)() : reply(200, value);
    }
    if (key === "GET /api/v1/products/menu") return reply(200, menu);
    return reply(404, { error: { status: 404, message: "x" } });
  });
}
const calls = (method: string, suffix: string) =>
  fetchMock.mock.calls.filter(([url, init]) => init?.method === method && String(url).endsWith(suffix));

beforeEach(async () => {
  mockUuid = 0;
  fetchMock.mockReset();
  mockPush.mockReset();
  await clearStore();
  await seedSession(orderUser, 10);
});

describe("pedido (órdenes sin restaurante)", () => {
  it("lista las órdenes abiertas como mosaicos y muestra la elegida con sus renglones", async () => {
    serve({
      "GET /api/v1/work_orders": { results: [order({ total: 40 })], info: { page_index: 1, page_end: 1, total: 1 } },
      "GET /api/v1/work_orders/5": order({ total: 40, items_count: 1, items: [{ id: 1, description: "Café", quantity: 2, unit_price: 20, position: 0, product_id: 7 }] }),
    });
    await renderScreen(<Pedido />);

    await fireEvent.press(await screen.findByRole("button", { name: /^Mesa 3, Ocupada, .*\$40\.00$/ }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    expect(await screen.findByTestId("order-line-1")).toBeTruthy();
    expect(screen.getByLabelText("Total $40.00")).toBeTruthy();
  });

  it("las tarjetas del menú muestran el icono del producto, el de su tipo o la inicial", async () => {
    const iconMenu = {
      menu: [{ category: "Bebidas", items: [
        { id: 7, name: "Café", price: 20, icon: "coffee" },
        { id: 8, name: "Té", price: 18, product_type: { icon: "cup" } },
        { id: 9, name: "Atole", price: 15 },
      ] }],
    };
    serve({
      "GET /api/v1/work_orders": { results: [], info: { page_index: 1, page_end: 1, total: 0 } },
      "POST /api/v1/work_orders": () => reply(201, order({ id: 9, title: "Luis" })),
      "GET /api/v1/work_orders/9": order({ id: 9, title: "Luis" }),
      "GET /api/v1/products/menu": iconMenu,
    });
    await renderScreen(<Pedido />);
    await screen.findByText("No hay órdenes abiertas.");
    await fireEvent.changeText(screen.getByLabelText("Mesa o cliente"), "Luis");
    await fireEvent.press(screen.getByRole("button", { name: "Nueva orden" }));

    expect(await screen.findByTestId("product-icon-coffee", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("product-icon-cup", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Atole, \$15.00/ })).toBeTruthy();
    expect(screen.getByText("A", { includeHiddenElements: true })).toBeTruthy();
  });

  it("abre una orden con el nombre y agrega un producto con la tarjeta", async () => {
    serve({
      "GET /api/v1/work_orders": { results: [], info: { page_index: 1, page_end: 1, total: 0 } },
      "POST /api/v1/work_orders": () => reply(201, order({ id: 9, title: "Luis" })),
      "GET /api/v1/work_orders/9": order({ id: 9, title: "Luis" }),
      "POST /api/v1/work_orders/9/items": () =>
        reply(201, order({ id: 9, title: "Luis", total: 20, items_count: 1, items: [{ id: 3, description: "Café", quantity: 1, unit_price: 20, position: 0, product_id: 7 }] })),
    });
    await renderScreen(<Pedido />);
    await screen.findByText("No hay órdenes abiertas.");

    await fireEvent.changeText(screen.getByLabelText("Mesa o cliente"), "Luis");
    await fireEvent.press(screen.getByRole("button", { name: "Nueva orden" }));
    await waitFor(() => expect(JSON.parse(calls("POST", "/work_orders")[0][1].body)).toEqual({ work_order: { title: "Luis" } }));

    await fireEvent.press(await screen.findByRole("button", { name: /^Café, \$20.00/ }));

    await waitFor(() => expect(calls("POST", "/work_orders/9/items")).toHaveLength(1));
    expect(JSON.parse(calls("POST", "/work_orders/9/items")[0][1].body)).toEqual({ product_id: 7, quantity: 1 });
  });
});

describe("pedido (orden cobrada o cancelada en otro lado)", () => {
  const listed = (o: WorkOrder) => ({ results: [o], info: { page_index: 1, page_end: 1, total: 1 } });

  async function watchThenChange(status: "paid" | "cancelled") {
    let now: WorkOrder["status"] = "open";
    serve({
      "GET /api/v1/work_orders": () => reply(200, listed(order({ total: 40 }))),
      "GET /api/v1/work_orders/5": () => reply(200, order({ total: 40, status: now })),
    });
    const view = await renderScreen(<Pedido />);
    await fireEvent.press(await screen.findByRole("button", { name: /^Mesa 3, Ocupada, .*\$40\.00$/ }));
    // El encabezado toma el nombre de la orden cuando ya cargó (abierta): recién ahí se cambia el estado.
    await screen.findByRole("header", { name: "Mesa 3" });

    now = status;
    await view.client.invalidateQueries();
  }

  it("cierra en pantalla una orden que se cobró en otro lado y avisa", async () => {
    await watchThenChange("paid");

    expect(await screen.findByText("La orden ya se cobró")).toBeTruthy();
    expect(screen.queryByTestId("order-bar")).toBeNull();
  });

  it("avisa cuando la orden se canceló", async () => {
    await watchThenChange("cancelled");

    expect(await screen.findByText("La orden se canceló")).toBeTruthy();
  });
});

describe("cobro desde la pantalla (mesas)", () => {
  const waiter = { id: 1, name: "Sara Staff" };
  const sent = { id: 1, name: "Sope", quantity: 1, unit_price: "25.00", note: null, status: "delivered" as const, station: null, kitchen_order_number: 1, sent_at: null, ready_at: null, allowed_actions: [] };
  const check = (): Check => ({
    id: 31, status: "open", table: { id: 1, name: "4" }, takeout_name: null, waiter, opened_at: "2026-10-20T10:00:00Z",
    total: "25.00", paid: "0.00", balance: "25.00", items: [sent], payments: [], ticket_id: null, allowed_actions: ["pay"],
  });

  beforeEach(async () => {
    await clearStore();
    await seedSession(staffUser, 10);
  });

  it("cobra sin salir de la pantalla y abre el ticket", async () => {
    serve({
      "GET /api/v1/restaurant/tables": {
        results: [{ id: 1, name: "4", active: true, position: 1, check: { id: 31, waiter, opened_at: "2026-10-20T10:00:00Z", total: "25.00", counts: { new: 0, preparing: 0, ready: 0, delivered: 1 }, mine: true } }],
        takeouts: [],
        ready_items: [],
      },
      "GET /api/v1/restaurant/checks/31": check(),
      "POST /api/v1/restaurant/checks/31/payments": () => reply(201, { payment: {}, check: { status: "closed", total: "25.00", paid: "25.00", balance: "0.00" }, ticket: { id: 70 } }),
    });
    await renderScreen(<Mesas />);

    await fireEvent.press(await screen.findByRole("button", { name: /^4, Ocupada, .*\$25\.00$/ }));
    await fireEvent.press(await screen.findByTestId("order-bar"));
    await fireEvent.press(await screen.findByRole("button", { name: "Cobrar" }));
    await fireEvent.changeText(await screen.findByLabelText("Recibido"), "50");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/ticket/70"));
    expect(JSON.parse(calls("POST", "/payments")[0][1].body)).toEqual({ method: "cash", amount: "25.00", amount_received: "50.00" });
  });
});
