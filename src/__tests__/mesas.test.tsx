import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import Mesas from "../../app/pedido";
import type { Check, TablesResponse } from "@/api/types";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockPush = jest.fn();
const mockRedirect = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));

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
  mockRedirect.mockReset();
  mockParams = {};
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
    // Elegir la mesa abre el menú con la barra; tocarla abre la orden en una hoja.
    expect(await screen.findByRole("button", { name: /Ver orden, Orden · 2 productos · \$60.00/ })).toBeTruthy();
    await fireEvent.press(screen.getByTestId("order-bar"));

    expect(await screen.findByTestId("order-line-1")).toBeTruthy();
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
    expect(screen.getByTestId("toast-error")).toBeTruthy();
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

  it("sin mesas (y sin modo pedido) vuelve a Órdenes en lugar de abrir un plano vacío", async () => {
    serve({ "GET /api/v1/restaurant/tables": tables({ results: [] }) });
    await renderScreen(<Mesas />);

    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith("/(tabs)/ordenes"));
  });

  it("abre la cuenta de ?cuenta=<id> al entrar desde la lista de Órdenes", async () => {
    mockParams = { cuenta: "31" };
    serve({ "GET /api/v1/restaurant/checks/31": check({ id: 31, table: { id: 1, name: "1" }, total: "0.00", items: [draft(1, "Tostada", 2)] }) });
    await renderScreen(<Mesas />);

    expect(await screen.findByText("Tostada")).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignora un valor de cuenta que no es un entero positivo", async () => {
    mockParams = { cuenta: "abc" };
    serve();
    await renderScreen(<Mesas />);

    expect(await screen.findByRole("button", { name: "2, Libre" })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/checks/"))).toBe(false);
  });
});

describe("mesas (cuenta cerrada afuera y liberar mesa)", () => {
  const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

  // Una cuenta que se ve abierta y luego se cobra o cancela afuera se cierra sola con su aviso.
  async function watchThenChange(status: "closed" | "cancelled") {
    let now: "open" | "closed" | "cancelled" = "open";
    serve({ "GET /api/v1/restaurant/checks/31": () => reply(200, check({ id: 31, table: { id: 1, name: "1" }, total: "155.00", status: now })) });
    const view = await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "1, Ocupada, $155.00" }));
    // El encabezado toma el nombre de la mesa cuando la cuenta ya cargó (abierta): recién ahí se cambia el estado.
    await screen.findByRole("header", { name: "1" });

    now = status;
    await view.client.invalidateQueries();
  }

  it("cierra en pantalla una cuenta que se cobró en otro lado y avisa", async () => {
    await watchThenChange("closed");

    expect(await screen.findByText("La cuenta ya se cobró o se cerró")).toBeTruthy();
    expect(screen.getByTestId("toast-info")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "2, Libre" })).toBeTruthy();
    expect(screen.queryByTestId("order-bar")).toBeNull();
  });

  it("avisa que se canceló cuando la cuenta pasa a cancelada", async () => {
    await watchThenChange("cancelled");

    expect(await screen.findByText("La cuenta se canceló")).toBeTruthy();
  });

  it("una cuenta que llega ya cerrada se ve en solo lectura, sin cerrarse sola", async () => {
    serve({ "GET /api/v1/restaurant/checks/31": check({ id: 31, table: { id: 1, name: "1" }, total: "155.00", status: "closed", ticket_id: 70 }) });
    await renderScreen(<Mesas />);

    await fireEvent.press(await screen.findByRole("button", { name: "1, Ocupada, $155.00" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    expect(await screen.findByText("Cuenta cerrada")).toBeTruthy();
    expect(screen.queryByText("La cuenta ya se cobró o se cerró")).toBeNull();
  });

  it("libera una mesa recién abierta de una vez, sin confirmar", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const open = check({ allowed_actions: ["add_item", "send", "pay", "cancel"] });
    serve({
      "POST /api/v1/restaurant/checks": () => reply(201, open),
      "GET /api/v1/restaurant/checks/77": open,
      "POST /api/v1/restaurant/checks/77/cancel": () => reply(200, check({ status: "cancelled" })),
    });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    await fireEvent.press(await screen.findByRole("button", { name: "Liberar mesa" }));

    await waitFor(() => expect(posts().some(([url]) => String(url).endsWith("/checks/77/cancel"))).toBe(true));
    expect(alert).not.toHaveBeenCalled();
    expect(await screen.findByText("Mesa liberada")).toBeTruthy();
    expect(screen.getByTestId("toast-success")).toBeTruthy(); // verde: no parece un error
    expect(screen.getByRole("button", { name: "2, Libre" })).toBeTruthy();
  });

  it("con productos sin mandar pide confirmar antes de liberar", async () => {
    let confirm: (() => void) | undefined;
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      confirm = buttons?.find((b) => b.style === "destructive")?.onPress as () => void;
    });
    const withDraft = check({ items: [draft(5, "Tostada", 1)], allowed_actions: ["add_item", "send", "pay", "cancel"] });
    serve({
      "POST /api/v1/restaurant/checks": () => reply(201, withDraft),
      "GET /api/v1/restaurant/checks/77": withDraft,
      "POST /api/v1/restaurant/checks/77/cancel": () => reply(200, check({ status: "cancelled" })),
    });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    await fireEvent.press(await screen.findByRole("button", { name: "Liberar mesa" }));
    // La hoja se cierra antes de preguntar (un solo modal a la vez), así que la confirmación llega un instante después.
    await waitFor(() => expect(confirm).toBeDefined());
    expect(posts().some(([url]) => String(url).endsWith("/cancel"))).toBe(false);

    confirm?.();
    await waitFor(() => expect(posts().some(([url]) => String(url).endsWith("/checks/77/cancel"))).toBe(true));
  });

  it("no ofrece Liberar mesa si la API no permite cancelar (ya se mandó algo)", async () => {
    const sent = check({ allowed_actions: ["add_item", "pay"] });
    serve({ "POST /api/v1/restaurant/checks": () => reply(201, sent), "GET /api/v1/restaurant/checks/77": sent });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    await screen.findByText("Toca un producto del menú para agregarlo.");
    expect(screen.queryByRole("button", { name: "Liberar mesa" })).toBeNull();
  });
});

describe("tomar pedido en dos pasos (spec 024)", () => {
  const withDraftItem = () => check({ total: "0.00", items: [draft(5, "Tostada", 2)], allowed_actions: ["add_item", "send", "pay", "cancel"] });

  it("elegir una mesa libre abre el menú con la barra vacía, sin pestañas Orden y Menú", async () => {
    serve({ "POST /api/v1/restaurant/checks": () => reply(201, check()), "GET /api/v1/restaurant/checks/77": check() });
    await renderScreen(<Mesas />);

    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));

    expect(await screen.findByRole("button", { name: /^Tostada, \$30.00/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver orden, Orden vacía" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Orden" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Menú" })).toBeNull();
  });

  it("agregar un producto actualiza la barra sin cambiar de pantalla", async () => {
    serve({
      "POST /api/v1/restaurant/checks": () => reply(201, check()),
      "GET /api/v1/restaurant/checks/77": check(),
      "POST /api/v1/restaurant/checks/77/items": () => reply(201, check({ total: "0.00", items: [draft(5, "Tostada", 1)] })),
    });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));

    await fireEvent.press(await screen.findByRole("button", { name: /^Tostada, \$30.00/ }));

    expect(await screen.findByRole("button", { name: "Ver orden, Orden · 1 producto · $30.00" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Sope/ })).toBeTruthy(); // sigue en el menú
  });

  it("Cambiar mesa regresa al plano", async () => {
    serve({ "POST /api/v1/restaurant/checks": () => reply(201, check()), "GET /api/v1/restaurant/checks/77": check() });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));

    await fireEvent.press(await screen.findByRole("button", { name: "Cambiar mesa" }));

    expect(await screen.findByRole("button", { name: "1, Ocupada, $155.00" })).toBeTruthy();
    expect(screen.queryByTestId("order-bar")).toBeNull();
  });

  it("la hoja sube y baja cantidades y quita renglones, y se cierra con su botón", async () => {
    const item = withDraftItem();
    serve({
      "POST /api/v1/restaurant/checks": () => reply(201, item),
      "GET /api/v1/restaurant/checks/77": item,
      "PATCH /api/v1/restaurant/checks/77/items/5": () => reply(200, check({ items: [draft(5, "Tostada", 3)] })),
      "DELETE /api/v1/restaurant/checks/77/items/5": () => reply(200, check()),
    });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    await fireEvent.press(await screen.findByRole("button", { name: /^Agregar una unidad de/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => init?.method === "PATCH" && String(url).endsWith("/items/5"))).toBe(true));
    await fireEvent.press(screen.getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => init?.method === "DELETE" && String(url).endsWith("/items/5"))).toBe(true));
  });

  it("Mandar desde la hoja manda la comanda y avisa", async () => {
    const item = withDraftItem();
    serve({
      "POST /api/v1/restaurant/checks": () => reply(201, item),
      "GET /api/v1/restaurant/checks/77": item,
      "POST /api/v1/restaurant/checks/77/rounds": () => reply(201, { kitchen_order: { id: 5, number: 4, sent_at: "x" }, sent: [{ id: 5, name: "Tostada", quantity: 2, station: null }], rejected: [], check: check({ items: [{ ...draft(5, "Tostada", 2), status: "new" }] }) }),
    });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    await fireEvent.press(await screen.findByRole("button", { name: "Mandar" }));

    // La hoja lleva su propia copia del toast (un Modal tapa al de la raíz), por eso aparece dos veces.
    expect((await screen.findAllByText("Comanda 4 mandada")).length).toBeGreaterThan(0);
  });

  it("Mandar cierra la hoja de inmediato y avisa con el toast", async () => {
    const item = withDraftItem();
    serve({
      "POST /api/v1/restaurant/checks": () => reply(201, item),
      "GET /api/v1/restaurant/checks/77": item,
      "POST /api/v1/restaurant/checks/77/rounds": () => reply(201, { kitchen_order: { id: 5, number: 7, sent_at: "x" }, sent: [{ id: 5, name: "Tostada", quantity: 2, station: null }], rejected: [], check: check({ items: [{ ...draft(5, "Tostada", 2), status: "new" }] }) }),
    });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    await fireEvent.press(await screen.findByRole("button", { name: "Mandar" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Seguir agregando" })).toBeNull());
    expect((await screen.findAllByText("Comanda 7 mandada")).length).toBeGreaterThan(0);
  });

  it("una nota por renglón (sin cebolla) se guarda en la cuenta", async () => {
    const item = withDraftItem();
    serve({
      "POST /api/v1/restaurant/checks": () => reply(201, item),
      "GET /api/v1/restaurant/checks/77": item,
      "PATCH /api/v1/restaurant/checks/77/items/5": () => reply(200, check({ items: [{ ...draft(5, "Tostada", 2), note: "sin cebolla" }] })),
    });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    await fireEvent.press(await screen.findByRole("button", { name: "Nota" }));
    await fireEvent.changeText(screen.getByLabelText("Nota"), "sin cebolla");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar nota" }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([url, init]) => init?.method === "PATCH" && String(url).endsWith("/items/5"));
      expect(JSON.parse(patch![1].body)).toEqual({ note: "sin cebolla" });
    });
  });

  it("Seguir agregando cierra la hoja y deja el menú", async () => {
    const item = withDraftItem();
    serve({ "POST /api/v1/restaurant/checks": () => reply(201, item), "GET /api/v1/restaurant/checks/77": item });
    await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));

    await fireEvent.press(await screen.findByRole("button", { name: "Seguir agregando" }));

    expect(screen.getByRole("button", { name: /^Tostada, \$30.00/ })).toBeTruthy();
  });

  it("una cuenta cobrada afuera con la hoja abierta cierra todo, avisa y regresa al plano", async () => {
    let status: "open" | "closed" = "open";
    const item = withDraftItem();
    serve({
      "POST /api/v1/restaurant/checks": () => reply(201, item),
      "GET /api/v1/restaurant/checks/77": () => reply(200, status === "open" ? item : { ...item, status: "closed" }),
    });
    const view = await renderScreen(<Mesas />);
    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));
    await fireEvent.press(await screen.findByTestId("order-bar"));
    await screen.findByRole("button", { name: "Seguir agregando" });

    status = "closed";
    await view.client.invalidateQueries();

    expect(await screen.findByText("La cuenta ya se cobró o se cerró")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "1, Ocupada, $155.00" })).toBeTruthy();
  });
});

