import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { ReadyAlertsHost } from "@/components/ready-alerts-host";
import { playReadySound } from "@/lib/sound";
import type { ReadyItem, TablesResponse } from "@/api/types";
import { clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("@/lib/sound", () => ({ playReadySound: jest.fn() }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const fetchMock = mockFetch();
const ready = (id: number, name: string, table: string | null = "4", takeout: string | null = null): ReadyItem => ({
  id, name, quantity: 1, check_id: 31, table, takeout_name: takeout, ready_at: "2026-10-19T19:00:00Z",
});
const tables = (ready_items: ReadyItem[]): TablesResponse => ({ results: [], takeouts: [], ready_items });

beforeEach(async () => {
  fetchMock.mockReset();
  mockPush.mockReset();
  (playReadySound as jest.Mock).mockClear();
  await clearStore();
  await seedSession(staffUser, 10);
});

describe("avisos de listo", () => {
  it("avisa con la mesa y el platillo", async () => {
    fetchMock.mockReturnValue(reply(200, tables([ready(1, "Tacos al pastor")])));
    await renderScreen(<ReadyAlertsHost />);

    expect(await screen.findByText("Mesa 4: Tacos al pastor listo")).toBeTruthy();
  });

  it("una cuenta para llevar avisa con el nombre del cliente", async () => {
    fetchMock.mockReturnValue(reply(200, tables([ready(2, "Cola", null, "Luis")])));
    await renderScreen(<ReadyAlertsHost />);

    expect(await screen.findByText("Luis: Cola listo")).toBeTruthy();
  });

  it("tocar el aviso abre la cuenta y lo descarta", async () => {
    fetchMock.mockReturnValue(reply(200, tables([ready(1, "Tacos al pastor")])));
    await renderScreen(<ReadyAlertsHost />);

    await fireEvent.press(await screen.findByRole("button", { name: /Mesa 4: Tacos al pastor listo/ }));

    expect(mockPush).toHaveBeenCalledWith("/pedido?cuenta=31&hoja=1");
    expect(screen.queryByText("Mesa 4: Tacos al pastor listo")).toBeNull();
  });

  it("descartar un aviso no lo repite en el siguiente sondeo", async () => {
    fetchMock.mockReturnValue(reply(200, tables([ready(1, "Tacos al pastor")])));
    const { client } = await renderScreen(<ReadyAlertsHost />);
    await screen.findByText("Mesa 4: Tacos al pastor listo");

    await fireEvent.press(screen.getByRole("button", { name: "Cerrar" }));
    const calls = fetchMock.mock.calls.length;
    await act(async () => {
      await client.invalidateQueries();
    });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(calls));
    expect(screen.queryByText("Mesa 4: Tacos al pastor listo")).toBeNull();
  });

  it("un artículo nuevo que pasa a listo genera otro aviso", async () => {
    fetchMock.mockReturnValue(reply(200, tables([ready(1, "Tacos al pastor")])));
    const { client } = await renderScreen(<ReadyAlertsHost />);
    await screen.findByText("Mesa 4: Tacos al pastor listo");

    fetchMock.mockReturnValue(reply(200, tables([ready(1, "Tacos al pastor"), ready(3, "Sopa del día")])));
    await act(async () => {
      await client.invalidateQueries();
    });

    expect(await screen.findByText("Mesa 4: Sopa del día listo")).toBeTruthy();
    expect(screen.getByText("Mesa 4: Tacos al pastor listo")).toBeTruthy();
  });

  it("el aviso se va solo cuando el artículo se entrega", async () => {
    fetchMock.mockReturnValue(reply(200, tables([ready(1, "Tacos al pastor")])));
    const { client } = await renderScreen(<ReadyAlertsHost />);
    await screen.findByText("Mesa 4: Tacos al pastor listo");

    fetchMock.mockReturnValue(reply(200, tables([])));
    await act(async () => {
      await client.invalidateQueries();
    });

    await waitFor(() => expect(screen.queryByText("Mesa 4: Tacos al pastor listo")).toBeNull());
  });

  it("no suena en la carga inicial, solo cuando aparece un artículo nuevo", async () => {
    fetchMock.mockReturnValue(reply(200, tables([ready(1, "Tacos al pastor")])));
    const { client } = await renderScreen(<ReadyAlertsHost />);
    await screen.findByText("Mesa 4: Tacos al pastor listo");
    expect(playReadySound).not.toHaveBeenCalled();

    fetchMock.mockReturnValue(reply(200, tables([ready(1, "Tacos al pastor"), ready(3, "Sopa del día")])));
    await act(async () => {
      await client.invalidateQueries();
    });

    await screen.findByText("Mesa 4: Sopa del día listo");
    expect(playReadySound).toHaveBeenCalled();
  });

  it("una empresa sin restaurante no muestra avisos ni deja de funcionar", async () => {
    fetchMock.mockReturnValue(reply(403, { error: { status: 403, message: "x", details: { code: "module_not_in_plan" } } }));
    await renderScreen(<ReadyAlertsHost />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("sin sesión no consulta nada", async () => {
    await clearStore();
    await renderScreen(<ReadyAlertsHost />);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
