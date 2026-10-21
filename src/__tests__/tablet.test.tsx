import { screen } from "@testing-library/react-native";
import Pedido from "../../app/pedido";
import type { TablesResponse } from "@/api/types";
import { clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
  Redirect: () => null,
}));
// Tableta: desde 768 dp el plano, la orden y el menú van juntos (sin barra ni hoja).
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1024, height: 768, scale: 2, fontScale: 1 }),
}));

const fetchMock = mockFetch();
const tables: TablesResponse = { results: [{ id: 2, name: "2", active: true, position: 1, check: null }], takeouts: [], ready_items: [] };

beforeEach(async () => {
  fetchMock.mockReset();
  await clearStore();
  await seedSession(staffUser, 10);
  fetchMock.mockImplementation((url: string) => {
    const path = new URL(url).pathname;
    if (path === "/api/v1/restaurant/tables") return reply(200, tables);
    if (path === "/api/v1/products/menu") return reply(200, { menu: [{ category: "Antojitos", items: [{ id: 7, name: "Tostada", price: 30 }] }] });
    return reply(404, { error: { status: 404, message: "x" } });
  });
});

describe("tableta (spec 024, FR-011)", () => {
  it("conserva dos columnas: plano y menú a la vez, sin barra de orden", async () => {
    await renderScreen(<Pedido />);

    expect(await screen.findByRole("button", { name: "2, Libre" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /^Tostada, \$30.00/ })).toBeTruthy();
    expect(screen.queryByTestId("order-bar")).toBeNull();
  });
});
