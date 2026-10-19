import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import Cuenta from "../../app/cuenta/[id]";
import type { Check } from "@/api/types";
import { clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "31" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock("expo-crypto", () => ({ randomUUID: () => "uuid-1" }));

const fetchMock = mockFetch();
const line = (id: number, name: string, status: "ready" | "delivered" | "preparing") => ({
  id, name, quantity: 1, unit_price: "30.00", note: null, status, station: { id: 2, name: "Barra" },
  kitchen_order_number: 1, sent_at: null, ready_at: null, allowed_actions: status === "ready" ? (["deliver"] as const) : [],
});
const check = (items: ReturnType<typeof line>[]): Check => ({
  id: 31, status: "open", table: { id: 1, name: "4" }, takeout_name: null, waiter: { id: 1, name: "Sara Staff" },
  opened_at: "2026-10-19T19:00:00Z", total: "60.00", paid: "0.00", balance: "60.00", items: items as Check["items"], payments: [],
  ticket_id: null, allowed_actions: ["add_item", "pay"],
});

beforeEach(async () => {
  fetchMock.mockReset();
  await clearStore();
  await seedSession(staffUser, 10);
});

describe("entrega", () => {
  it("entregar un artículo listo lo marca entregado y quita el botón", async () => {
    let state = check([line(3, "Refresco de cola", "ready"), line(4, "Sopa del día", "preparing")]);
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === "POST" && String(url).endsWith("/items/3/deliver")) {
        state = check([line(3, "Refresco de cola", "delivered"), line(4, "Sopa del día", "preparing")]);
      }
      return reply(200, String(url).includes("/products/menu") ? { menu: [] } : state);
    });
    await renderScreen(<Cuenta />);

    await fireEvent.press(await screen.findByRole("button", { name: "Entregar" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull());
    expect(screen.getByText("ENTREGADO")).toBeTruthy();
    expect(screen.getByText("EN PREPARACIÓN")).toBeTruthy();
  });

  it("solo ofrece entregar lo que está listo, no lo que sigue en preparación", async () => {
    fetchMock.mockImplementation((url: string) => reply(200, String(url).includes("/products/menu") ? { menu: [] } : check([line(4, "Sopa del día", "preparing")])));
    await renderScreen(<Cuenta />);

    await screen.findByText("1 × Sopa del día");
    expect(screen.queryByRole("button", { name: "Entregar" })).toBeNull();
  });
});
