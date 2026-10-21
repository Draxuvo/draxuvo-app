import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import Pedido from "../../app/pedido";
import { NetworkError } from "@/api/client";
import type { Check, CheckItem, TablesResponse } from "@/api/types";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

// La cuenta vive en la hoja de la orden de Tomar pedido (spec 025). Estas pruebas vienen de las pantallas
// "Cuenta completa" y "cobro de cuenta", que ya no existen: el comportamiento es el mismo en la hoja.
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ cuenta: "31", hoja: "1" }),
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
  Redirect: () => null,
}));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockUuid}` }));

const fetchMock = mockFetch();
const item = (id: number, name: string, status: CheckItem["status"], extra: Partial<CheckItem> = {}): CheckItem => ({
  id, name, quantity: 1, unit_price: "70.00", note: null, status, station: { id: 1, name: "Cocina" },
  kitchen_order_number: status === "draft" ? null : 1, sent_at: null, ready_at: null, allowed_actions: [], ...extra,
});
const check = (items: CheckItem[], actions: Check["allowed_actions"] = ["add_item", "send", "pay"], extra: Partial<Check> = {}): Check => ({
  id: 31, status: "open", table: { id: 1, name: "4" }, takeout_name: null, waiter: { id: 1, name: "Sara Staff" },
  opened_at: "2026-10-19T19:00:00Z", total: "140.00", paid: "0.00", balance: "140.00", items, payments: [],
  ticket_id: null, allowed_actions: actions, ...extra,
});
const tables: TablesResponse = { results: [{ id: 1, name: "4", active: true, position: 1, check: null }], takeouts: [], ready_items: [] };
const menu = { menu: [{ category: "Platillos", items: [{ id: 1, name: "Tacos al pastor", price: 70 }, { id: 2, name: "Refresco de cola", price: 30, sold_out: true }] }] };

let current: Check;
const route = (handlers: Record<string, () => Promise<unknown>> = {}) =>
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
    if (handlers[key]) return handlers[key]();
    if (key === "GET /api/v1/restaurant/tables") return reply(200, tables);
    if (key === "GET /api/v1/products/menu") return reply(200, menu);
    if (key === "GET /api/v1/restaurant/checks/waiters") return reply(200, { results: [{ id: 1, name: "Sara Staff" }, { id: 2, name: "Luis" }] });
    if (key === "GET /api/v1/payment_terminals") return reply(200, { results: [] });
    return reply(200, current);
  });
const calls = (method: string, suffix: string) =>
  fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? "GET") === method && String(url).endsWith(suffix));

beforeEach(async () => {
  mockUuid = 0;
  mockPush.mockReset();
  fetchMock.mockReset();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await clearStore();
  await seedSession(staffUser, 10);
  current = check([item(1, "Sopa del día", "draft")]);
});

describe("la cuenta en la hoja: comandas y estados", () => {
  it("separa lo sin mandar de las comandas con su estado", async () => {
    current = check([item(1, "Sopa del día", "draft"), item(2, "Tacos al pastor", "preparing"), item(3, "Cola", "ready", { allowed_actions: ["deliver"] })]);
    route();
    await renderScreen(<Pedido />);

    expect(await screen.findByText("SIN MANDAR")).toBeTruthy();
    expect(screen.getByText("COMANDA 1")).toBeTruthy();
    expect(screen.getByText("EN PREPARACIÓN")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entregar" })).toBeTruthy();
  });

  it("el total incluye lo que aún no se manda", async () => {
    current = { ...check([item(1, "Sopa del día", "draft"), item(2, "Tacos al pastor", "new")]), total: "70.00" };
    route();
    await renderScreen(<Pedido />);

    expect(await screen.findByLabelText("Total $140.00")).toBeTruthy();
  });

  it("solo dibuja las acciones que manda la API", async () => {
    current = check([item(2, "Tacos al pastor", "preparing")], ["add_item"]);
    route();
    await renderScreen(<Pedido />);

    await screen.findByText("1 × Tacos al pastor");
    expect(screen.queryByRole("button", { name: "Mandar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cobrar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
  });

  it("un producto agotado no se puede elegir en el menú", async () => {
    route();
    await renderScreen(<Pedido />);

    const soldOut = await screen.findByRole("button", { name: /Refresco de cola.*Agotado/ });
    expect(soldOut.props.accessibilityState.disabled).toBe(true);
  });

  it("una cuenta que no existe o es de otra empresa muestra el error", async () => {
    route({ "GET /api/v1/restaurant/checks/31": () => apiError(404, null, "no") });
    await renderScreen(<Pedido />);

    expect(await screen.findByText("No se pudo abrir la orden.")).toBeTruthy();
  });
});

describe("la cuenta en la hoja: mandar", () => {
  it("manda con una llave de idempotencia y muestra lo rechazado por agotado", async () => {
    const after = check([item(2, "Sopa del día", "new")]);
    route({
      "POST /api/v1/restaurant/checks/31/rounds": () =>
        reply(201, { kitchen_order: { id: 5, number: 1, sent_at: "x" }, sent: [], rejected: [{ id: 9, name: "Refresco de cola", reason: "sold_out", available_qty: 0 }], check: after }),
    });
    await renderScreen(<Pedido />);

    await fireEvent.press(await screen.findByRole("button", { name: "Mandar" }));

    expect((await screen.findAllByText(/Refresco de cola: agotado/)).length).toBeGreaterThan(0);
    expect(calls("POST", "/rounds")[0][1].headers["Idempotency-Key"]).toBe("uuid-1");
  });

  it("sin conexión avisa que no se envió y reintenta con la misma llave", async () => {
    let attempts = 0;
    route({
      "POST /api/v1/restaurant/checks/31/rounds": () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new NetworkError()) : reply(201, { kitchen_order: { id: 5, number: 1, sent_at: "x" }, sent: [], rejected: [], check: current });
      },
    });
    await renderScreen(<Pedido />);

    await fireEvent.press(await screen.findByRole("button", { name: "Mandar" }));
    expect((await screen.findAllByText("No se envió. Revisa tu conexión y vuelve a intentar.")).length).toBeGreaterThan(0);

    // Mandar cierra la hoja: se vuelve a abrir desde la barra para reintentar.
    await fireEvent.press(await screen.findByTestId("order-bar"));
    await fireEvent.press(await screen.findByRole("button", { name: "Mandar" }));
    await waitFor(() => expect(attempts).toBe(2));
    expect(calls("POST", "/rounds").map(([, init]) => init.headers["Idempotency-Key"])).toEqual(["uuid-1", "uuid-1"]);
  });
});

describe("la cuenta en la hoja: entregar y cancelar", () => {
  const line = (id: number, name: string, status: "ready" | "delivered" | "preparing") =>
    item(id, name, status, { quantity: 1, unit_price: "30.00", station: { id: 2, name: "Barra" }, allowed_actions: status === "ready" ? ["deliver"] : [] });

  it("entregar un artículo listo lo marca entregado y quita el botón", async () => {
    let state = check([line(3, "Refresco de cola", "ready"), line(4, "Sopa del día", "preparing")], ["add_item", "pay"]);
    route({
      "POST /api/v1/restaurant/checks/31/items/3/deliver": () => {
        state = check([line(3, "Refresco de cola", "delivered"), line(4, "Sopa del día", "preparing")], ["add_item", "pay"]);
        return reply(200, state);
      },
      "GET /api/v1/restaurant/checks/31": () => reply(200, state),
    });
    await renderScreen(<Pedido />);

    await fireEvent.press(await screen.findByRole("button", { name: "Entregar" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull());
    expect(screen.getByText("ENTREGADO")).toBeTruthy();
    expect(screen.getByText("EN PREPARACIÓN")).toBeTruthy();
  });

  it("solo ofrece entregar lo que está listo, no lo que sigue en preparación", async () => {
    current = check([line(3, "Refresco de cola", "ready"), line(4, "Sopa del día", "preparing")], ["add_item", "pay"]);
    route();
    await renderScreen(<Pedido />);

    await screen.findByText("EN PREPARACIÓN");
    expect(screen.getAllByRole("button", { name: "Entregar" })).toHaveLength(1);
  });

  it("pide el motivo antes de cancelar algo ya mandado, dentro de la misma hoja", async () => {
    current = check([item(2, "Tacos al pastor", "new", { allowed_actions: ["cancel"] })], ["add_item"]);
    route();
    await renderScreen(<Pedido />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Escribe el motivo")).toBeTruthy();
    expect(calls("POST", "/items/2/cancel")).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText("Motivo"), "El cliente cambió de idea");
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(JSON.parse(calls("POST", "/items/2/cancel")[0][1].body)).toEqual({ reason: "El cliente cambió de idea" }));
  });

  it("un encargado cancela lo que ya está en preparación con motivo", async () => {
    current = check([item(2, "Tacos al pastor", "preparing", { allowed_actions: ["cancel"] })]);
    route();
    await renderScreen(<Pedido />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }));
    await fireEvent.changeText(screen.getByLabelText("Motivo"), "Se quemó");
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(JSON.parse(calls("POST", "/items/2/cancel")[0][1].body)).toEqual({ reason: "Se quemó" }));
  });

  it("un mesero no ve cancelar en lo que ya está en preparación", async () => {
    current = check([item(2, "Tacos al pastor", "preparing")], ["add_item"]);
    route();
    await renderScreen(<Pedido />);

    await screen.findByText("1 × Tacos al pastor");
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
  });

  it("si la API lo niega muestra el motivo y no cambia nada", async () => {
    current = check([item(2, "Tacos al pastor", "new", { allowed_actions: ["cancel"] })], ["add_item"]);
    route({ "POST /api/v1/restaurant/checks/31/items/2/cancel": () => apiError(403, "No tienes permiso para esta acción", "x") });
    await renderScreen(<Pedido />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }));
    await fireEvent.changeText(screen.getByLabelText("Motivo"), "x");
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));

    expect((await screen.findAllByText("No tienes permiso para esta acción")).length).toBeGreaterThan(0);
  });
});

describe("la cuenta en la hoja: correcciones y mesero", () => {
  it("quita un artículo sin mandar y cambia su cantidad", async () => {
    current = check([item(1, "Sopa del día", "draft", { quantity: 2 })], ["add_item", "send"]);
    route();
    await renderScreen(<Pedido />);

    await fireEvent.press(await screen.findByLabelText(/^Agregar una unidad de/));
    await waitFor(() => expect(JSON.parse(calls("PATCH", "/items/1")[0][1].body)).toEqual({ quantity: 3 }));
    await fireEvent.press(screen.getByRole("button", { name: "Quitar" }));
    await waitFor(() => expect(calls("DELETE", "/items/1")).toHaveLength(1));
  });

  it("un encargado cambia de mesero desde la hoja", async () => {
    current = check([item(1, "Sopa del día", "draft")], ["add_item", "send", "reassign"]);
    route({ "PATCH /api/v1/restaurant/checks/31": () => reply(200, current) });
    await renderScreen(<Pedido />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cambiar mesero" }));
    await fireEvent.press(await screen.findByRole("button", { name: "Luis" }));

    await waitFor(() => expect(JSON.parse(calls("PATCH", "/checks/31")[0][1].body)).toEqual({ waiter_id: 2 }));
  });

  it("sin permiso para reasignar no aparece Cambiar mesero", async () => {
    route();
    await renderScreen(<Pedido />);

    await screen.findByTestId("order-line-1");
    expect(screen.queryByRole("button", { name: "Cambiar mesero" })).toBeNull();
  });
});

describe("la cuenta cerrada se ve en solo lectura", () => {
  it("no se cierra sola, no tiene controles y ofrece Ver ticket", async () => {
    current = check([item(2, "Tacos al pastor", "delivered")], ["add_item"], { status: "closed", ticket_id: 70 });
    route();
    await renderScreen(<Pedido />);

    expect(await screen.findByText("Cuenta cerrada")).toBeTruthy();
    expect(screen.queryByText("La cuenta ya se cobró o se cerró")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mandar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cobrar" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Ver ticket" }));
    expect(mockPush).toHaveBeenCalledWith("/ticket/70");
  });
});

describe("cobrar desde la hoja", () => {
  const paid = () => check([item(2, "Tacos al pastor", "delivered")], ["add_item", "pay"], { total: "500.00", balance: "500.00" });
  const paymentCalls = () => calls("POST", "/payments");
  const lastBody = () => JSON.parse(paymentCalls().at(-1)![1].body);
  const openPay = async () => {
    await fireEvent.press(await screen.findByRole("button", { name: "Cobrar" }));
    return screen.findByLabelText("Recibido");
  };

  it("muestra total, pagado y saldo", async () => {
    current = { ...paid(), paid: "200.00", balance: "300.00", payments: [{ id: 1, method: "cash", amount: "200.00", reference: null, amount_received: "200.00", change_given: "0.00" }] };
    route();
    await renderScreen(<Pedido />);
    await openPay();

    expect((await screen.findAllByText("$300.00")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$500.00").length).toBeGreaterThan(0);
  });

  it("efectivo calcula el cambio y manda el recibido", async () => {
    current = paid();
    route({ "POST /api/v1/restaurant/checks/31/payments": () => reply(201, { payment: {}, check: { status: "closed" }, ticket: { id: 70 } }) });
    await renderScreen(<Pedido />);

    await fireEvent.changeText(await openPay(), "600");
    expect((await screen.findByTestId("payment-change")).props.children).toBe("Cambio: $100.00");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(paymentCalls()).toHaveLength(1));
    expect(lastBody()).toEqual({ method: "cash", amount: "500.00", amount_received: "600.00" });
  });

  it("al cerrar la cuenta lleva al ticket", async () => {
    current = paid();
    route({ "POST /api/v1/restaurant/checks/31/payments": () => reply(201, { payment: {}, check: { status: "closed" }, ticket: { id: 70 } }) });
    await renderScreen(<Pedido />);
    await openPay();

    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/ticket/70"));
  });

  it("un pago parcial no cierra la cuenta", async () => {
    current = paid();
    route({ "POST /api/v1/restaurant/checks/31/payments": () => reply(201, { payment: {}, check: { status: "open" }, ticket: null }) });
    await renderScreen(<Pedido />);
    await openPay();

    await fireEvent.changeText(screen.getByLabelText("Monto"), "200");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(paymentCalls()).toHaveLength(1));
    expect(lastBody().amount).toBe("200.00");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("tarjeta pide la referencia antes de enviar", async () => {
    current = paid();
    route({ "POST /api/v1/restaurant/checks/31/payments": () => reply(201, { payment: {}, check: { status: "open" }, ticket: null }) });
    await renderScreen(<Pedido />);
    await openPay();

    await fireEvent.press(await screen.findByRole("radio", { name: "Tarjeta" }));
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));
    expect((await screen.findAllByText("Escribe la referencia")).length).toBeGreaterThan(0);
    expect(paymentCalls()).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText("Referencia"), "A8812");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));
    await waitFor(() => expect(paymentCalls()).toHaveLength(1));
    expect(lastBody()).toEqual({ method: "card", amount: "500.00", reference: "A8812" });
  });

  it("tarjeta elige la terminal del negocio y la manda con la referencia (spec 015)", async () => {
    current = paid();
    const terminals = [
      { id: 5, name: "Point barra", provider: "mercado_pago", provider_label: "Mercado Pago", active: true },
      { id: 6, name: "BBVA caja", provider: "bbva", provider_label: "BBVA", active: true },
    ];
    route({
      "POST /api/v1/restaurant/checks/31/payments": () => reply(201, { payment: {}, check: { status: "open" }, ticket: null }),
      "GET /api/v1/payment_terminals": () => reply(200, { results: terminals }),
    });
    await renderScreen(<Pedido />);
    await openPay();

    await fireEvent.press(await screen.findByRole("radio", { name: "Tarjeta" }));
    await fireEvent.changeText(screen.getByLabelText("Referencia"), "A8812");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));
    expect((await screen.findAllByText("Elige la terminal en que se cobró.")).length).toBeGreaterThan(0);
    expect(paymentCalls()).toHaveLength(0);

    await fireEvent.press(await screen.findByRole("button", { name: "Point barra" }));
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));
    await waitFor(() => expect(paymentCalls()).toHaveLength(1));
    expect(lastBody()).toEqual({ method: "card", amount: "500.00", reference: "A8812", terminal_id: 5 });
  });

  it("transferencia no deja pagar más que el saldo", async () => {
    current = paid();
    route();
    await renderScreen(<Pedido />);
    await openPay();

    await fireEvent.press(await screen.findByRole("radio", { name: "Transferencia" }));
    await fireEvent.changeText(screen.getByLabelText("Monto"), "900");
    await fireEvent.changeText(screen.getByLabelText("Referencia"), "T1");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    expect((await screen.findAllByText("El pago no puede exceder el saldo")).length).toBeGreaterThan(0);
    expect(paymentCalls()).toHaveLength(0);
  });

  it("sin conexión avisa y reintenta con la misma llave", async () => {
    current = paid();
    let attempts = 0;
    route({
      "POST /api/v1/restaurant/checks/31/payments": () => {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new NetworkError()) : reply(201, { payment: {}, check: { status: "closed" }, ticket: { id: 70 } });
      },
    });
    await renderScreen(<Pedido />);
    await openPay();

    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));
    expect((await screen.findAllByText("No se pudo registrar el pago")).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(paymentCalls()).toHaveLength(2));
    expect(paymentCalls().map(([, init]) => init.headers["Idempotency-Key"])).toEqual(["uuid-1", "uuid-1"]);
  });

  it("con comandas sin completar pide confirmar y cobra igual", async () => {
    current = paid();
    let first = true;
    route({
      "POST /api/v1/restaurant/checks/31/payments": () => {
        if (first) {
          first = false;
          return apiError(422, { code: "incomplete_items", pending: 2 }, "incompletos");
        }
        return reply(201, { payment: {}, check: { status: "closed" }, ticket: { id: 70 } });
      },
    });
    await renderScreen(<Pedido />);
    await openPay();

    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const [title, body, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe("Hay artículos sin completar");
    expect(body).toContain("2");

    buttons.find((b: { text: string }) => b.text === "Cobrar igual").onPress();

    await waitFor(() => expect(paymentCalls()).toHaveLength(2));
    expect(lastBody().confirm_incomplete).toBe(true);
  });
});
