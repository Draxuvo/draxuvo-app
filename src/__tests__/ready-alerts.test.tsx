import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { RestaurantAlertsHost } from "@/components/restaurant-alerts-host";
import { playReadySound } from "@/lib/sound";
import type { CheckSummary, ReadyItem, TablesResponse, TableState, TableSummary } from "@/api/types";
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
const check = (id: number, over: Partial<CheckSummary> = {}): CheckSummary => ({
  id, opened_at: "2026-10-19T18:00:00Z", total: "120.00", counts: { new: 0, preparing: 0, ready: 0, delivered: 2 }, mine: true, ...over,
});
const table = (id: number, name: string, state: TableState, own: CheckSummary | null): TableSummary => ({ id, name, active: true, position: id, state, check: own });
const overview = (over: Partial<TablesResponse> = {}): TablesResponse => ({ results: [], takeouts: [], ready_items: [], ...over });
const tables = (ready_items: ReadyItem[]): TablesResponse => overview({ ready_items });

type Rendered = Awaited<ReturnType<typeof renderScreen>>;

const TABLES_KEY = ["company", 10, "restaurant", "tables"];

/**
 * Abre la pantalla y espera a que el primer sondeo resuelva: si no, el sondeo siguiente pisaría la
 * respuesta inicial (la carga inicial solo se registra) y el aviso no se vería como un cambio.
 */
async function mountWith(payload: TablesResponse): Promise<Rendered> {
  fetchMock.mockReturnValue(reply(200, payload));
  const rendered = await renderScreen(<RestaurantAlertsHost />);
  await waitFor(() => expect(rendered.client.getQueryData(TABLES_KEY)).toBeTruthy());
  return rendered;
}

/** Abre la pantalla con lo que ya estaba listo (la carga inicial no debe avisar). */
async function mount(initial: ReadyItem[] = []): Promise<Rendered> {
  return mountWith(tables(initial));
}

/** Un sondeo nuevo: así se ve un "pasa a listo", un "queda por cobrar" o una "mesa tomada" en vivo. */
async function poll(client: Rendered["client"], payload: TablesResponse): Promise<void> {
  fetchMock.mockReturnValue(reply(200, payload));
  await act(async () => {
    await client.invalidateQueries();
  });
}

async function pollReady(client: Rendered["client"], items: ReadyItem[]): Promise<void> {
  await poll(client, tables(items));
}

beforeEach(async () => {
  fetchMock.mockReset();
  mockPush.mockReset();
  (playReadySound as jest.Mock).mockClear();
  await clearStore();
  await seedSession(staffUser, 10);
});

describe("avisos de listo", () => {
  it("no avisa por lo que ya estaba listo al abrir", async () => {
    await mount([ready(1, "Tacos al pastor")]);

    expect(screen.queryByText("Mesa 4: Tacos al pastor listo")).toBeNull();
  });

  it("avisa con la mesa y el platillo cuando un artículo pasa a listo", async () => {
    const { client } = await mount([]);
    await pollReady(client, [ready(1, "Tacos al pastor")]);

    expect(await screen.findByText("Mesa 4: Tacos al pastor listo")).toBeTruthy();
  });

  it("una cuenta para llevar avisa con el nombre del cliente", async () => {
    const { client } = await mount([]);
    await pollReady(client, [ready(2, "Cola", null, "Luis")]);

    expect(await screen.findByText("Luis: Cola listo")).toBeTruthy();
  });

  it("tocar el aviso abre la cuenta y lo descarta", async () => {
    const { client } = await mount([]);
    await pollReady(client, [ready(1, "Tacos al pastor")]);

    await fireEvent.press(await screen.findByRole("button", { name: /Mesa 4: Tacos al pastor listo/ }));

    expect(mockPush).toHaveBeenCalledWith("/pedido?cuenta=31&hoja=1");
    expect(screen.queryByText("Mesa 4: Tacos al pastor listo")).toBeNull();
  });

  it("descartar un aviso no lo repite en el siguiente sondeo", async () => {
    const { client } = await mount([]);
    await pollReady(client, [ready(1, "Tacos al pastor")]);
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
    const { client } = await mount([]);
    await pollReady(client, [ready(1, "Tacos al pastor")]);
    await screen.findByText("Mesa 4: Tacos al pastor listo");

    await pollReady(client, [ready(1, "Tacos al pastor"), ready(3, "Sopa del día")]);

    expect(await screen.findByText("Mesa 4: Sopa del día listo")).toBeTruthy();
    expect(screen.getByText("Mesa 4: Tacos al pastor listo")).toBeTruthy();
  });

  it("muestra tres avisos y resume el resto en un contador", async () => {
    const { client } = await mount([]);
    await pollReady(client, [ready(1, "Uno"), ready(2, "Dos"), ready(3, "Tres"), ready(4, "Cuatro")]);

    await screen.findByText("Mesa 4: Uno listo");
    expect(screen.getByText("Mesa 4: Dos listo")).toBeTruthy();
    expect(screen.getByText("Mesa 4: Tres listo")).toBeTruthy();
    expect(screen.queryByText("Mesa 4: Cuatro listo")).toBeNull();
    expect(screen.getByText("+1")).toBeTruthy();
  });

  it("avisa cuando una cuenta propia queda por cobrar", async () => {
    const { client } = await mountWith(overview({ results: [table(4, "Mesa 4", "occupied", check(31))] }));
    await poll(client, overview({ results: [table(4, "Mesa 4", "to_pay", check(31))] }));

    expect(await screen.findByText("Mesa 4 por cobrar")).toBeTruthy();
  });

  it("avisa cuando otra persona toma una mesa libre", async () => {
    const { client } = await mountWith(overview({ results: [table(4, "Mesa 4", "free", null)] }));
    await poll(client, overview({ results: [table(4, "Mesa 4", "occupied", check(31, { mine: false }))] }));

    expect(await screen.findByText("Mesa 4: la tomó otra persona")).toBeTruthy();
  });

  it("el aviso se va solo cuando el artículo se entrega", async () => {
    const { client } = await mount([]);
    await pollReady(client, [ready(1, "Tacos al pastor")]);
    await screen.findByText("Mesa 4: Tacos al pastor listo");

    await pollReady(client, []);

    await waitFor(() => expect(screen.queryByText("Mesa 4: Tacos al pastor listo")).toBeNull());
  });

  it("no suena en la carga inicial, solo cuando aparece un artículo nuevo", async () => {
    const { client } = await mount([ready(1, "Tacos al pastor")]);
    await act(async () => {
      await client.invalidateQueries();
    });
    expect(playReadySound).not.toHaveBeenCalled();

    await pollReady(client, [ready(1, "Tacos al pastor"), ready(3, "Sopa del día")]);

    await screen.findByText("Mesa 4: Sopa del día listo");
    expect(playReadySound).toHaveBeenCalled();
  });

  it("una empresa sin restaurante no muestra avisos ni deja de funcionar", async () => {
    fetchMock.mockReturnValue(reply(403, { error: { status: 403, message: "x", details: { code: "module_not_in_plan" } } }));
    await renderScreen(<RestaurantAlertsHost />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("sin sesión no consulta nada", async () => {
    await clearStore();
    await renderScreen(<RestaurantAlertsHost />);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
