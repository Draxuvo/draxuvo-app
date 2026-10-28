import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import Alertas from "../../app/alertas";
import { AppHeader } from "@/components/app-header";
import type { AlertsResponse, OperationalAlert, SnoozedAlert } from "@/api/types";
import { alertRoute, formatElapsed } from "@/lib/alerts";
import { setLocale } from "@/i18n";
import { setOutboxStore } from "@/outbox/queue";
import { createMemoryStore } from "@/test/memory-outbox-store";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";
import { resetToasts } from "@/toast/store";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }), Stack: { Screen: () => null } }));

const fetchMock = mockFetch();

const asRole = (role: "admin" | "owner" | "staff") => ({
  ...staffUser,
  role,
  companies: [{ ...staffUser.companies[0], role }],
});

const table: OperationalAlert = {
  id: "table_open:check:45:t:1730000000", kind: "table_open", severity: "critical", minutes: 190, threshold_minutes: 90,
  subject: { type: "check", id: 45, label: "Mesa 4", check_id: 45 }, owner: { type: "waiter", name: "Ana López" },
  total: "845.00", stock: null, min_stock: null,
};
const order: OperationalAlert = {
  id: "work_order_stalled:wo:77:t:1730000100", kind: "work_order_stalled", severity: "warning", minutes: 1500, threshold_minutes: 1440,
  subject: { type: "work_order", id: 77, label: "Orden #77 · Instalar contactos" }, owner: { type: "employee", name: "Empleado Pro" },
  total: null, stock: null, min_stock: null,
};
const stock: OperationalAlert = {
  id: "low_stock:product:9", kind: "low_stock", severity: "warning", minutes: null, threshold_minutes: null,
  subject: { type: "product", id: 9, label: "Café en grano" }, owner: null, total: null, stock: 1.5, min_stock: 3,
};
const snoozed: SnoozedAlert = {
  ...table, id: "table_open:check:50:t:1730001000", subject: { type: "check", id: 50, label: "Mesa 7", check_id: 50 },
  snoozed_until: "2026-10-28T02:30:00Z", snoozed_by: "Luis Pérez",
};

function body(over: Partial<AlertsResponse> = {}): AlertsResponse {
  const results = over.results ?? [table, order, stock];
  return { info: { page_size: 50, page_index: 1, total: results.length, page_start: 1, page_end: results.length }, count: results.length, results, snoozed: [], ...over };
}

const calls = (method: string, suffix: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).includes(suffix) && (init?.method ?? "GET") === method);

function serve(response: AlertsResponse = body()) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/alerts/snooze")) return init?.method === "DELETE" ? reply(204, null) : reply(201, { id: "x", snoozed_until: "2026-10-28T03:00:00Z", snoozed_by: "Yo" });
    if (path.endsWith("/alerts")) return reply(200, response);
    return reply(200, {});
  });
}

beforeEach(async () => {
  fetchMock.mockReset();
  mockPush.mockReset();
  setOutboxStore(createMemoryStore()); // el encabezado lee la cola de envíos pendientes
  await setLocale("es");
  await clearStore();
});

afterEach(() => resetToasts());

describe("Alertas operativas (spec 045)", () => {
  it("lista cada alerta con su tipo, tiempo, responsable y total", async () => {
    await seedSession(asRole("owner"), 10);
    serve();
    await renderScreen(<Alertas />);

    expect(await screen.findByText("Mesa 4")).toBeTruthy();
    expect(screen.getByText("Mesa abierta mucho tiempo · Mesero: Ana López")).toBeTruthy();
    expect(screen.getByText("Lleva 3 h 10 min (límite 1 h 30 min) · Total $845.00")).toBeTruthy();
    expect(screen.getByText("Orden #77 · Instalar contactos")).toBeTruthy();
    expect(screen.getByText("Existencia 1.5 · Mínimo 3")).toBeTruthy();
    expect(screen.getByText("3 alertas activas")).toBeTruthy();
  });

  it("abre la cuenta o la orden, y el stock bajo no se abre ni se pospone", async () => {
    await seedSession(asRole("admin"), 10);
    serve();
    await renderScreen(<Alertas />);

    const open = await screen.findAllByRole("button", { name: "Abrir" });
    expect(open).toHaveLength(2);
    await fireEvent.press(open[0]);
    expect(mockPush).toHaveBeenCalledWith("/pedido?cuenta=45&hoja=1");
    await fireEvent.press(open[1]);
    expect(mockPush).toHaveBeenCalledWith("/ordenes/77");
    expect(screen.getAllByRole("button", { name: "Posponer" })).toHaveLength(2);
  });

  it("pospone con el plazo elegido y avisa con un toast", async () => {
    await seedSession(asRole("owner"), 10);
    serve();
    await renderScreen(<Alertas />);

    await fireEvent.press((await screen.findAllByRole("button", { name: "Posponer" }))[0]);
    await fireEvent.press(await screen.findByRole("button", { name: "1 hora" }));

    await waitFor(() => expect(calls("POST", "/alerts/snooze")).toHaveLength(1));
    expect(JSON.parse(calls("POST", "/alerts/snooze")[0][1].body)).toEqual({ kind: "table_open", subject_key: "check:45:t:1730000000", minutes: 60 });
    expect(await screen.findByText("Alerta pospuesta")).toBeTruthy();
  });

  it("las pospuestas van aparte y se pueden quitar", async () => {
    await seedSession(asRole("owner"), 10);
    serve(body({ snoozed: [snoozed] }));
    await renderScreen(<Alertas />);

    expect(await screen.findByText("Pospuestas (1)")).toBeTruthy();
    expect(screen.getByText("Mesa 7")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Quitar posposición" }));

    await waitFor(() => expect(calls("DELETE", "/alerts/snooze")).toHaveLength(1));
    expect(String(calls("DELETE", "/alerts/snooze")[0][0])).toContain("subject_key=check%3A50%3At%3A1730001000");
  });

  it("sin alertas muestra el estado vacío", async () => {
    await seedSession(asRole("owner"), 10);
    serve(body({ results: [], count: 0 }));
    await renderScreen(<Alertas />);
    expect(await screen.findByText(/Todo en orden/)).toBeTruthy();
  });

  it("con más alertas de las que caben ofrece ver más y pide la página grande", async () => {
    await seedSession(asRole("owner"), 10);
    serve(body({ count: 120 }));
    await renderScreen(<Alertas />);

    await fireEvent.press(await screen.findByRole("button", { name: "Ver más" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("page_size=100"))).toBe(true));
  });

  it("si la API falla ofrece reintentar", async () => {
    await seedSession(asRole("owner"), 10);
    fetchMock.mockImplementation(() => apiError(500, null, "Error interno del servidor"));
    await renderScreen(<Alertas />);
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("el staff no entra: no consulta nada", async () => {
    await seedSession(asRole("staff"), 10);
    serve();
    await renderScreen(<Alertas />);
    expect(screen.queryByText("Mesa 4")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Campana del encabezado (spec 045)", () => {
  it("el dueño ve el conteo y la campana lleva a Alertas", async () => {
    await seedSession(asRole("owner"), 10);
    serve();
    await renderScreen(<AppHeader title="Órdenes" />);

    const bell = await screen.findByRole("button", { name: "Alertas, 3 activas" });
    await fireEvent.press(bell);
    expect(mockPush).toHaveBeenCalledWith("/alertas");
  });

  it("el staff no ve la campana ni consulta alertas", async () => {
    await seedSession(asRole("staff"), 10);
    serve();
    await renderScreen(<AppHeader title="Órdenes" />);
    expect(screen.queryByRole("button", { name: /Alertas/ })).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/alerts"))).toHaveLength(0);
  });
});

describe("lib/alerts", () => {
  it("formatea minutos como min, h o d", async () => {
    await setLocale("es");
    expect([5, 60, 190, 1440, 1500].map(formatElapsed)).toEqual(["5 min", "1 h", "3 h 10 min", "1 d", "1 d 1 h"]);
  });

  it("la ruta de cada alerta: cuenta, orden, o ninguna para un producto", () => {
    expect(alertRoute(table)).toBe("/pedido?cuenta=45&hoja=1");
    expect(alertRoute(order)).toBe("/ordenes/77");
    expect(alertRoute(stock)).toBeNull();
  });
});
