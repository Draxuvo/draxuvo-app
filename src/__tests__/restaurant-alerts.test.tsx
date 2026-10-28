import { screen } from "@testing-library/react-native";
import { renderScreen } from "@/test/render";
import { RestaurantAlertsHost } from "@/components/restaurant-alerts-host";
import type { CheckSummary, ReadyItem, TablesResponse, TableState, TableSummary } from "@/api/types";
import { clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("@/lib/sound", () => ({ playReadySound: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const fetchMock = mockFetch();
const ready = (id: number, name = "Tacos al pastor"): ReadyItem => ({
  id, name, quantity: 1, check_id: 31, table: "4", takeout_name: null, ready_at: "2026-10-19T19:00:00Z",
});
const check = (id: number): CheckSummary => ({
  id, opened_at: "2026-10-19T18:00:00Z", total: "120.00", counts: { new: 0, preparing: 0, ready: 0, delivered: 2 }, mine: true,
});
const table = (id: number, name: string, state: TableState, own: CheckSummary | null): TableSummary => ({ id, name, active: true, position: id, state, check: own });

beforeEach(async () => {
  fetchMock.mockReset();
  await clearStore();
  await seedSession(staffUser, 10);
});

describe("avisos del restaurante", () => {
  it("no avisa por lo que ya estaba listo o por cobrar al abrir la app (FR-013)", async () => {
    const data: TablesResponse = { results: [table(4, "Mesa 4", "to_pay", check(31))], takeouts: [], ready_items: [ready(1)] };
    fetchMock.mockReturnValue(reply(200, data));

    await renderScreen(<RestaurantAlertsHost />);

    expect(screen.queryByText("Mesa 4: Tacos al pastor listo")).toBeNull();
    expect(screen.queryByText("Mesa 4 por cobrar")).toBeNull();
  });

  it("una empresa sin restaurante no muestra avisos", async () => {
    fetchMock.mockReturnValue(reply(403, { error: { status: 403, message: "x", details: { code: "module_not_in_plan" } } }));

    await renderScreen(<RestaurantAlertsHost />);

    expect(screen.queryByLabelText("Cerrar")).toBeNull();
  });

  it("sin sesión no consulta nada", async () => {
    await clearStore();

    await renderScreen(<RestaurantAlertsHost />);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
