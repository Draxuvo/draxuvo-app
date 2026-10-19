import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import CuentaCobro from "../../app/cuenta-cobro/[id]";
import { NetworkError } from "@/api/client";
import type { Check } from "@/api/types";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "31" }),
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));
let mockUuid = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `uuid-${++mockUuid}` }));

const fetchMock = mockFetch();
const check = (extra: Partial<Check> = {}): Check => ({
  id: 31, status: "open", table: { id: 1, name: "4" }, takeout_name: null, waiter: { id: 1, name: "Sara Staff" },
  opened_at: "2026-10-19T19:00:00Z", total: "500.00", paid: "0.00", balance: "500.00", items: [], payments: [],
  ticket_id: null, allowed_actions: ["pay"], ...extra,
});
const paymentCalls = () => fetchMock.mock.calls.filter(([url, init]) => init?.method === "POST" && String(url).endsWith("/payments"));
const lastBody = () => JSON.parse(paymentCalls().at(-1)![1].body);

let current: Check;
const route = (onPay: () => Promise<unknown>) =>
  fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
    init?.method === "POST" && String(url).endsWith("/payments") ? onPay() : reply(200, current),
  );

beforeEach(async () => {
  mockUuid = 0;
  mockReplace.mockReset();
  fetchMock.mockReset();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  await clearStore();
  await seedSession(staffUser, 10);
  current = check();
});

describe("cobro de la cuenta", () => {
  it("muestra total, pagado y saldo", async () => {
    current = check({ paid: "200.00", balance: "300.00", payments: [{ id: 1, method: "cash", amount: "200.00", reference: null, amount_received: "200.00", change_given: "0.00" }] });
    route(() => reply(201, {}));
    await renderScreen(<CuentaCobro />);

    expect(await screen.findByText("$300.00")).toBeTruthy();
    expect(screen.getByText("$500.00")).toBeTruthy();
    expect(screen.getAllByText("$200.00")).toHaveLength(2); // pagado y el renglón del pago
    expect(screen.getAllByText("Efectivo").length).toBeGreaterThan(1);
  });

  it("efectivo calcula el cambio y manda el recibido", async () => {
    route(() => reply(201, { payment: {}, check: { status: "closed" }, ticket: { id: 70 } }));
    await renderScreen(<CuentaCobro />);

    await fireEvent.changeText(await screen.findByLabelText("Recibido"), "600");
    expect((await screen.findByTestId("payment-change")).props.children).toBe("Cambio: $100.00");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(paymentCalls()).toHaveLength(1));
    expect(lastBody()).toEqual({ method: "cash", amount: "500.00", amount_received: "600.00" });
  });

  it("al cerrar la cuenta lleva al ticket", async () => {
    route(() => reply(201, { payment: {}, check: { status: "closed" }, ticket: { id: 70 } }));
    await renderScreen(<CuentaCobro />);

    await fireEvent.press(await screen.findByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/ticket/70"));
  });

  it("un pago parcial no cierra la cuenta", async () => {
    route(() => reply(201, { payment: {}, check: { status: "open" }, ticket: null }));
    await renderScreen(<CuentaCobro />);

    await fireEvent.changeText(await screen.findByLabelText("Monto"), "200");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(paymentCalls()).toHaveLength(1));
    expect(lastBody().amount).toBe("200.00");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("tarjeta pide la referencia antes de enviar", async () => {
    route(() => reply(201, { payment: {}, check: { status: "open" }, ticket: null }));
    await renderScreen(<CuentaCobro />);

    await fireEvent.press(await screen.findByRole("radio", { name: "Tarjeta" }));
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));
    expect(await screen.findByText("Escribe la referencia")).toBeTruthy();
    expect(paymentCalls()).toHaveLength(0);

    await fireEvent.changeText(screen.getByLabelText("Referencia"), "A8812");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(paymentCalls()).toHaveLength(1));
    expect(lastBody()).toEqual({ method: "card", amount: "500.00", reference: "A8812" });
  });

  it("tarjeta no deja pagar más que el saldo", async () => {
    route(() => reply(201, {}));
    await renderScreen(<CuentaCobro />);

    await fireEvent.press(await screen.findByRole("radio", { name: "Transferencia" }));
    await fireEvent.changeText(screen.getByLabelText("Monto"), "900");
    await fireEvent.changeText(screen.getByLabelText("Referencia"), "T1");
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    expect(await screen.findByText("El pago no puede exceder el saldo")).toBeTruthy();
    expect(paymentCalls()).toHaveLength(0);
  });

  it("sin conexión avisa y reintenta con la misma llave", async () => {
    let calls = 0;
    route(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new NetworkError()) : reply(201, { payment: {}, check: { status: "closed" }, ticket: { id: 70 } });
    });
    await renderScreen(<CuentaCobro />);

    await fireEvent.press(await screen.findByRole("button", { name: "Registrar pago" }));
    expect(await screen.findByText("No se pudo registrar el pago")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(paymentCalls()).toHaveLength(2));
    expect(paymentCalls().map(([, init]) => init.headers["Idempotency-Key"])).toEqual(["uuid-1", "uuid-1"]);
  });

  it("con comandas sin completar pide confirmar y cobra igual", async () => {
    let first = true;
    route(() => {
      if (first) {
        first = false;
        return apiError(422, { code: "incomplete_items", pending: 2 }, "incompletos");
      }
      return reply(201, { payment: {}, check: { status: "closed" }, ticket: { id: 70 } });
    });
    await renderScreen(<CuentaCobro />);

    await fireEvent.press(await screen.findByRole("button", { name: "Registrar pago" }));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const [title, body, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toBe("Hay artículos sin completar");
    expect(body).toContain("2");

    buttons.find((b: { text: string }) => b.text === "Cobrar igual").onPress();

    await waitFor(() => expect(paymentCalls()).toHaveLength(2));
    expect(lastBody().confirm_incomplete).toBe(true);
  });

  it("una cuenta cerrada ya no muestra el formulario", async () => {
    current = check({ status: "closed", balance: "0.00", paid: "500.00" });
    route(() => reply(201, {}));
    await renderScreen(<CuentaCobro />);

    await screen.findByText("Saldo por cobrar");
    expect(screen.queryByRole("button", { name: "Registrar pago" })).toBeNull();
  });
});
