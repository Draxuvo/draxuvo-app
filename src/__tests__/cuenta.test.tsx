import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import Cuenta from "../../app/cuenta/[id]";
import { NetworkError } from "@/api/client";
import type { Check, CheckItem } from "@/api/types";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "31" }),
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockUuid}` }));

const fetchMock = mockFetch();
const item = (id: number, name: string, status: CheckItem["status"], extra: Partial<CheckItem> = {}): CheckItem => ({
  id, name, quantity: 1, unit_price: "70.00", note: null, status, station: { id: 1, name: "Cocina" },
  kitchen_order_number: status === "draft" ? null : 1, sent_at: null, ready_at: null, allowed_actions: [], ...extra,
});
const check = (items: CheckItem[], actions: Check["allowed_actions"] = ["add_item", "send", "pay"]): Check => ({
  id: 31, status: "open", table: { id: 1, name: "4" }, takeout_name: null, waiter: { id: 1, name: "Sara Staff" },
  opened_at: "2026-10-19T19:00:00Z", total: "140.00", paid: "0.00", balance: "140.00", items, payments: [],
  ticket_id: null, allowed_actions: actions,
});
const menu = { menu: [{ category: "Platillos", items: [
  { id: 1, name: "Tacos al pastor", price: 70 },
  { id: 2, name: "Refresco de cola", price: 30, sold_out: true },
] }] };

let current: Check;
const route = (handlers: Record<string, () => Promise<unknown>> = {}) =>
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
    if (handlers[key]) return handlers[key]();
    if (key === "GET /api/v1/products/menu") return reply(200, menu);
    return reply(200, current);
  });

beforeEach(async () => {
  mockUuid = 0;
  mockPush.mockReset();
  fetchMock.mockReset();
  await clearStore();
  await seedSession(staffUser, 10);
  current = check([item(1, "Sopa del día", "draft")]);
});

describe("cuenta", () => {
  it("separa lo sin mandar de las comandas con su estado", async () => {
    current = check([item(1, "Sopa del día", "draft"), item(2, "Tacos al pastor", "preparing"), item(3, "Cola", "ready", { allowed_actions: ["deliver"] })]);
    route();
    await renderScreen(<Cuenta />);

    expect(await screen.findByText("SIN MANDAR")).toBeTruthy();
    expect(screen.getByText("COMANDA 1")).toBeTruthy();
    expect(screen.getByText("EN PREPARACIÓN")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entregar" })).toBeTruthy();
  });

  it("el total incluye lo que aún no se manda", async () => {
    current = { ...check([item(1, "Sopa del día", "draft"), item(2, "Tacos al pastor", "new")]), total: "70.00" };
    route();
    await renderScreen(<Cuenta />);

    expect(await screen.findByLabelText("Total $140.00")).toBeTruthy();
  });

  it("solo dibuja las acciones que manda la API", async () => {
    current = check([item(2, "Tacos al pastor", "preparing", { allowed_actions: [] })], ["add_item"]);
    route();
    await renderScreen(<Cuenta />);

    await screen.findByText("1 × Tacos al pastor");
    expect(screen.queryByRole("button", { name: "Mandar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cobrar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
  });

  it("manda con una llave de idempotencia y muestra lo rechazado por agotado", async () => {
    const after = check([item(2, "Sopa del día", "new")]);
    route({
      "POST /api/v1/restaurant/checks/31/rounds": () =>
        reply(201, { kitchen_order: { id: 5, number: 1, sent_at: "x" }, sent: [], rejected: [{ id: 9, name: "Refresco de cola", reason: "sold_out", available_qty: 0 }], check: after }),
    });
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Mandar" }));

    expect(await screen.findByText(/Refresco de cola: agotado/)).toBeTruthy();
    expect(screen.getByTestId("toast-error")).toBeTruthy();
    const post = fetchMock.mock.calls.find(([url, init]) => init?.method === "POST" && String(url).endsWith("/rounds"));
    expect(post![1].headers["Idempotency-Key"]).toBe("uuid-1");
  });

  it("sin conexión avisa que no se envió y reintenta con la misma llave", async () => {
    let calls = 0;
    route({
      "POST /api/v1/restaurant/checks/31/rounds": () => {
        calls += 1;
        return calls === 1 ? Promise.reject(new NetworkError()) : reply(201, { kitchen_order: { id: 5, number: 1, sent_at: "x" }, sent: [], rejected: [], check: current });
      },
    });
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Mandar" }));
    expect(await screen.findByText("No se envió. Revisa tu conexión y vuelve a intentar.")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Mandar" }));
    await waitFor(() => expect(calls).toBe(2));
    const keys = fetchMock.mock.calls.filter(([url, init]) => init?.method === "POST" && String(url).endsWith("/rounds")).map(([, init]) => init.headers["Idempotency-Key"]);
    expect(keys).toEqual(["uuid-1", "uuid-1"]);
  });

  it("un producto agotado no se puede elegir en el menú", async () => {
    route();
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Agregar" }));

    const soldOut = await screen.findByRole("button", { name: /Refresco de cola.*Agotado/ });
    expect(soldOut.props.accessibilityState.disabled).toBe(true);
    expect(await screen.findByRole("button", { name: /Tacos al pastor/ })).toBeTruthy();
  });

  it("agrega un producto con cantidad y nota", async () => {
    route();
    await renderScreen(<Cuenta />);
    await fireEvent.press(await screen.findByRole("button", { name: "Agregar" }));

    await fireEvent.press(await screen.findByRole("button", { name: /Tacos al pastor/ }));
    await fireEvent.press(screen.getAllByText("+").at(-1)!);
    await fireEvent.changeText(screen.getByLabelText("Nota"), "sin cebolla");
    await fireEvent.press(screen.getAllByRole("button", { name: "Agregar" }).at(-1)!);

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([url, init]) => init?.method === "POST" && String(url).endsWith("/items"));
      expect(JSON.parse(post![1].body)).toEqual({ product_id: 1, quantity: 2, note: "sin cebolla" });
    });
  });

  it("pide el motivo antes de cancelar algo ya mandado", async () => {
    current = check([item(2, "Tacos al pastor", "new", { allowed_actions: ["cancel"] })], ["add_item"]);
    route();
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Escribe el motivo")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Motivo"), "El cliente cambió de idea");
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([url, init]) => init?.method === "POST" && String(url).endsWith("/items/2/cancel"));
      expect(JSON.parse(post![1].body)).toEqual({ reason: "El cliente cambió de idea" });
    });
  });

  it("entrega un artículo listo", async () => {
    current = check([item(3, "Cola", "ready", { allowed_actions: ["deliver"] })], ["add_item", "pay"]);
    route();
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Entregar" }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => init?.method === "POST" && String(url).endsWith("/items/3/deliver"))).toBe(true));
  });

  it("lleva al cobro cuando no queda nada por mandar", async () => {
    current = check([item(2, "Tacos al pastor", "delivered")], ["add_item", "pay"]);
    route();
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cobrar" }));

    expect(mockPush).toHaveBeenCalledWith("/cuenta-cobro/31");
  });

  it("una cuenta de otra empresa muestra el error", async () => {
    route({ "GET /api/v1/restaurant/checks/31": () => apiError(404, null, "no") });
    await renderScreen(<Cuenta />);

    expect(await screen.findByText("Esto ya no está disponible.")).toBeTruthy();
  });
});
