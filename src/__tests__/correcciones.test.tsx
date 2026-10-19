import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import Cuenta from "../../app/cuenta/[id]";
import type { Check, CheckItem } from "@/api/types";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "31" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
  Stack: { Screen: () => null },
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => "uuid-1" }));

const fetchMock = mockFetch();
const item = (id: number, name: string, status: CheckItem["status"], actions: CheckItem["allowed_actions"] = []): CheckItem => ({
  id, name, quantity: 2, unit_price: "70.00", note: null, status, station: { id: 1, name: "Cocina" },
  kitchen_order_number: status === "draft" ? null : 1, sent_at: null, ready_at: null, allowed_actions: actions,
});
const check = (items: CheckItem[], actions: Check["allowed_actions"] = ["add_item"]): Check => ({
  id: 31, status: "open", table: { id: 1, name: "4" }, takeout_name: null, waiter: { id: 1, name: "Sara Staff" },
  opened_at: "2026-10-19T19:00:00Z", total: "0.00", paid: "0.00", balance: "0.00", items, payments: [], ticket_id: null, allowed_actions: actions,
});

let current: Check;
const calls = (method: string, suffix: string) =>
  fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? "GET") === method && String(url).endsWith(suffix));
const serve = (extra: Record<string, () => Promise<unknown>> = {}) =>
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const key = `${init?.method ?? "GET"} ${new URL(url).pathname}`;
    if (extra[key]) return extra[key]();
    return reply(200, String(url).includes("/products/menu") ? { menu: [] } : current);
  });

beforeEach(async () => {
  mockBack.mockReset();
  fetchMock.mockReset();
  await clearStore();
  await seedSession(staffUser, 10);
});

describe("correcciones durante el servicio", () => {
  it("quita un artículo sin mandar", async () => {
    current = check([item(1, "Sopa del día", "draft")], ["add_item", "send"]);
    serve();
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Quitar" }));

    await waitFor(() => expect(calls("DELETE", "/items/1")).toHaveLength(1));
  });

  it("cambia la cantidad de un artículo sin mandar", async () => {
    current = check([item(1, "Sopa del día", "draft")], ["add_item", "send"]);
    serve();
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByText("+"));

    await waitFor(() => expect(JSON.parse(calls("PATCH", "/items/1")[0][1].body)).toEqual({ quantity: 3 }));
  });

  it("un mesero no ve cancelar en lo que ya está en preparación", async () => {
    current = check([item(2, "Tacos al pastor", "preparing", [])]);
    serve();
    await renderScreen(<Cuenta />);

    await screen.findByText("2 × Tacos al pastor");
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();
  });

  it("un encargado cancela con motivo y la API lo guarda", async () => {
    current = check([item(2, "Tacos al pastor", "preparing", ["cancel"])]);
    serve();
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }));
    await fireEvent.changeText(screen.getByLabelText("Motivo"), "Se quemó");
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(JSON.parse(calls("POST", "/items/2/cancel")[0][1].body)).toEqual({ reason: "Se quemó" }));
  });

  it("no cancela sin motivo", async () => {
    current = check([item(2, "Tacos al pastor", "new", ["cancel"])]);
    serve();
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }));
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Escribe el motivo")).toBeTruthy();
    expect(calls("POST", "/items/2/cancel")).toHaveLength(0);
  });

  it("si la API lo niega muestra el motivo y no cambia nada", async () => {
    current = check([item(2, "Tacos al pastor", "new", ["cancel"])]);
    serve({ "POST /api/v1/restaurant/checks/31/items/2/cancel": () => apiError(403, "No tienes permiso para esta acción", "x") });
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar" }));
    await fireEvent.changeText(screen.getByLabelText("Motivo"), "x");
    await fireEvent.press(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByTestId("check-error")).toBeTruthy();
  });

  it("una cuenta vacía se cancela y vuelve a las mesas", async () => {
    current = check([], ["add_item", "cancel"]);
    serve({ "POST /api/v1/restaurant/checks/31/cancel": () => reply(200, { ...current, status: "cancelled" }) });
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Cancelar cuenta" }));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(calls("POST", "/cancel")).toHaveLength(1);
  });
});
