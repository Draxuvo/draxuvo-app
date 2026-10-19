import { screen } from "@testing-library/react-native";
import TicketScreen from "../../app/ticket/[id]";
import type { Ticket } from "@/api/types";
import { clearStore, mockFetch, multiUser, reply, seedSession } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "70" }),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("expo-sharing", () => ({ isAvailableAsync: async () => true, shareAsync: jest.fn() }));
jest.mock("expo-file-system", () => ({ Paths: { cache: "cache" }, File: Object.assign(jest.fn(), { downloadFileAsync: jest.fn() }) }));

const fetchMock = mockFetch();
const ticket: Ticket = {
  id: 70, folio: "T-0070", work_order: null, status: "paid", total: 500, created_at: "2026-10-19T19:00:00Z",
  payment_method: "mixed", amount_received: 600, change_given: 100,
  check: { id: 31, table: "4", takeout_name: null, waiter: { id: 1, name: "Sara" } },
  payments: [
    { id: 1, method: "cash", amount: "200.00", reference: null, amount_received: "300.00", change_given: "100.00" },
    { id: 2, method: "card", amount: "300.00", reference: "A8812", amount_received: null, change_given: null },
  ],
};

beforeEach(async () => {
  mockReplace.mockReset();
  fetchMock.mockReset();
  await clearStore();
  await seedSession(multiUser, 10);
  fetchMock.mockImplementation((url: string) =>
    url.endsWith("/subscription") ? reply(200, { status: "active", active_access: true, active_modules: ["whatsapp"] }) : reply(200, ticket),
  );
});

describe("ticket de una cuenta", () => {
  it("muestra la mesa y cada pago con su método y referencia", async () => {
    await renderScreen(<TicketScreen />);

    expect(await screen.findByText("T-0070")).toBeTruthy();
    expect(screen.getByTestId("ticket-check").props.children).toBe("Mesa 4");
    expect(screen.getByText("Efectivo")).toBeTruthy();
    expect(screen.getByText("Tarjeta · Ref. A8812")).toBeTruthy();
    expect(screen.getByText("$300.00")).toBeTruthy();
    expect(screen.getByText(/Cambio: \$100\.00/)).toBeTruthy();
  });

  it("no ofrece WhatsApp porque la cuenta no guarda teléfono del cliente", async () => {
    await renderScreen(<TicketScreen />);
    await screen.findByText("T-0070");

    expect(screen.queryByRole("button", { name: "Enviar por WhatsApp" })).toBeNull();
    expect(screen.getByRole("button", { name: "Descargar y compartir PDF" })).toBeTruthy();
  });

  it("vuelve a las mesas, no a las órdenes", async () => {
    await renderScreen(<TicketScreen />);

    const back = await screen.findByRole("button", { name: "Ir a mesas" });
    expect(back).toBeTruthy();
  });

  it("una cuenta para llevar muestra el nombre del cliente", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/subscription")
        ? reply(200, { status: "active", active_access: true, active_modules: [] })
        : reply(200, { ...ticket, check: { id: 32, table: null, takeout_name: "Luis", waiter: null } }),
    );
    await renderScreen(<TicketScreen />);

    expect((await screen.findByTestId("ticket-check")).props.children).toBe("Para llevar: Luis");
  });
});
