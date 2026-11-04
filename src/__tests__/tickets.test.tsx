import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { TicketsHistory } from "@/components/orders/tickets-history";
import type { Ticket } from "@/api/types";
import { clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const fetchMock = mockFetch();
const ticket = (id: number, folio: string, status: Ticket["status"]): Ticket => ({
  id, folio, status, work_order_id: id, total: 80, created_at: "2026-10-15T10:00:00Z", work_order: { id, title: `Orden ${id}` },
});
const page = (results: Ticket[]) => reply(200, { info: { page_size: 20, page_index: 1, total: results.length, page_start: 1, page_end: results.length }, results });
const lastUrl = () => new URL(fetchMock.mock.calls.at(-1)![0]);

beforeEach(async () => {
  fetchMock.mockReset();
  mockPush.mockReset();
  await clearStore();
  await seedSession(staffUser, 10);
  fetchMock.mockImplementation(() => page([ticket(1, "T-0001", "paid"), ticket(2, "T-0002", "pending")]));
});

describe("historial de tickets (Órdenes → Cobradas → Historial)", () => {
  it("lista los tickets y abre uno", async () => {
    await renderScreen(<TicketsHistory />);

    await fireEvent.press(await screen.findByRole("button", { name: /T-0001/ }));

    expect(mockPush).toHaveBeenCalledWith("/ticket/1");
  });

  it("filtra por estado", async () => {
    await renderScreen(<TicketsHistory />);
    await screen.findByText("T-0001");

    await fireEvent.press(screen.getByRole("button", { name: "Cobrado" }));

    await waitFor(() => expect(lastUrl().searchParams.get("status")).toBe("paid"));
  });

  it("busca por folio", async () => {
    await renderScreen(<TicketsHistory />);
    await screen.findByText("T-0001");

    await fireEvent.changeText(screen.getByTestId("tickets-search"), "T-0002");

    await waitFor(() => expect(lastUrl().searchParams.get("search")).toBe("T-0002"));
  });

  it("sin tickets muestra el estado vacío", async () => {
    fetchMock.mockImplementation(() => page([]));
    await renderScreen(<TicketsHistory />);

    expect(await screen.findByText("No hay tickets.")).toBeTruthy();
  });

  describe("folio leído o escrito en la cámara (spec 056)", () => {
    async function scan(code: string) {
      await fireEvent.press(await screen.findByLabelText("Escanear con cámara"));
      const input = await screen.findByLabelText("Código de barras");
      await fireEvent.changeText(input, code);
      await fireEvent(input, "submitEditing");
    }

    it("un folio exacto abre ese ticket y deja la búsqueda aplicada", async () => {
      await renderScreen(<TicketsHistory />);
      await screen.findByText("T-0001");

      await scan("T-0002");

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/ticket/2"));
      await waitFor(() => expect(lastUrl().searchParams.get("search")).toBe("T-0002"));
    });

    it("un folio que no existe solo filtra: no abre nada ni revela otras empresas", async () => {
      fetchMock.mockImplementation(() => page([]));
      await renderScreen(<TicketsHistory />);
      await screen.findByText("No hay tickets.");

      await scan("T-999999");

      await waitFor(() => expect(lastUrl().searchParams.get("search")).toBe("T-999999"));
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
