import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import Mesas from "../../app/(tabs)/mesas";
import type { TablesResponse } from "@/api/types";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

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

beforeEach(async () => {
  fetchMock.mockReset();
  mockPush.mockReset();
  await clearStore();
  await seedSession(staffUser, 10);
});

describe("mesas", () => {
  it("pinta las mesas libres y ocupadas", async () => {
    fetchMock.mockReturnValue(reply(200, tables()));
    await renderScreen(<Mesas />);

    expect(await screen.findByRole("button", { name: /^1, Sara Staff/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2, Libre" })).toBeTruthy();
  });

  it("abre la cuenta existente al tocar una mesa ocupada", async () => {
    fetchMock.mockReturnValue(reply(200, tables()));
    await renderScreen(<Mesas />);

    await fireEvent.press(await screen.findByRole("button", { name: /^1, Sara Staff/ }));

    expect(mockPush).toHaveBeenCalledWith("/cuenta/31");
  });

  it("abre una cuenta nueva al tocar una mesa libre", async () => {
    fetchMock.mockImplementation((url: string, init?: { method?: string; body?: string }) =>
      init?.method === "POST" ? reply(201, { id: 77, status: "open", items: [], payments: [], allowed_actions: [] }) : reply(200, tables()),
    );
    await renderScreen(<Mesas />);

    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/cuenta/77"));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post![1].body)).toEqual({ dining_table_id: 2 });
  });

  it("avisa cuando la mesa ya está ocupada", async () => {
    fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
      init?.method === "POST" ? apiError(422, { code: "table_occupied" }, "ocupada") : reply(200, tables()),
    );
    await renderScreen(<Mesas />);

    await fireEvent.press(await screen.findByRole("button", { name: "2, Libre" }));

    expect(await screen.findByText("La mesa ya tiene una cuenta abierta")).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("abre una cuenta para llevar con el nombre del cliente", async () => {
    fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
      init?.method === "POST" ? reply(201, { id: 90, status: "open", items: [], payments: [], allowed_actions: [] }) : reply(200, tables()),
    );
    await renderScreen(<Mesas />);
    await screen.findByRole("button", { name: "2, Libre" });

    await fireEvent.changeText(screen.getByLabelText("Nombre del cliente"), "Luis");
    await fireEvent.press(screen.getByRole("button", { name: "Nuevo para llevar" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/cuenta/90"));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(post![1].body)).toEqual({ takeout_name: "Luis" });
  });

  it("muestra las alertas de inventario solo si la API las manda", async () => {
    fetchMock.mockReturnValue(reply(200, tables({ stock_alerts: 2 })));
    await renderScreen(<Mesas />);
    expect(screen.queryByTestId("stock-alerts")).toBeNull();
  });

  it("sin mesas muestra el estado vacío", async () => {
    fetchMock.mockReturnValue(reply(200, tables({ results: [] })));
    await renderScreen(<Mesas />);

    expect(await screen.findByText("Aún no hay mesas")).toBeTruthy();
  });
});
