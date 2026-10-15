import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import TicketScreen from "../../app/ticket/[id]";
import type { Ticket } from "@/api/types";
import { apiError, clearStore, mockFetch, multiUser, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "9" }),
  useRouter: () => ({ replace: jest.fn() }),
}));
const mockShare = jest.fn();
const mockDownload = jest.fn();
jest.mock("expo-sharing", () => ({ isAvailableAsync: async () => true, shareAsync: (...a: unknown[]) => mockShare(...a) }));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "cache" },
  File: Object.assign(
    jest.fn().mockImplementation(() => ({ exists: false, delete: jest.fn() })),
    { downloadFileAsync: (...a: unknown[]) => mockDownload(...a) },
  ),
}));

const fetchMock = mockFetch();

const ticket: Ticket = {
  id: 9, folio: "T-0042", work_order_id: 5, status: "paid", total: 80, created_at: "2026-10-15T10:00:00Z",
  payment_method: "cash", amount_received: 100, change_given: 20,
};

/** Responde ticket y suscripción por separado. */
function serve(subscription: () => Promise<unknown>) {
  fetchMock.mockImplementation((url: string, init: { method: string }) => {
    if (url.endsWith("/subscription")) return subscription();
    if (url.endsWith("/send_whatsapp")) return reply(200, { message: "ok" });
    return reply(200, ticket);
  });
}

beforeEach(async () => {
  fetchMock.mockReset();
  mockShare.mockReset();
  mockDownload.mockReset().mockResolvedValue({ uri: "file:///cache/ticket.pdf" });
  await clearStore();
});

describe("pantalla del ticket", () => {
  it("muestra folio, total y cambio", async () => {
    await seedSession(multiUser, 10);
    serve(() => reply(200, { status: "active", active_access: true, active_modules: [] }));
    await renderScreen(<TicketScreen />);

    expect(await screen.findByText("T-0042")).toBeTruthy();
    expect(screen.getByText("$80.00")).toBeTruthy();
    expect(screen.getByText(/Cambio: \$20\.00/)).toBeTruthy();
  });

  it("descarga el PDF con la sesión y abre el menú de compartir", async () => {
    await seedSession(multiUser, 10);
    serve(() => reply(200, { status: "active", active_access: true, active_modules: [] }));
    await renderScreen(<TicketScreen />);

    await fireEvent.press(await screen.findByRole("button", { name: "Descargar y compartir PDF" }));

    await waitFor(() => expect(mockShare).toHaveBeenCalledWith("file:///cache/ticket.pdf", expect.objectContaining({ mimeType: "application/pdf" })));
    expect(mockDownload.mock.calls[0][0]).toMatch(/\/tickets\/9\/download$/);
    expect(mockDownload.mock.calls[0][2].headers.Authorization).toBe("Bearer tok");
  });

  it("WhatsApp aparece solo si el plan lo incluye", async () => {
    await seedSession(multiUser, 10);
    serve(() => reply(200, { status: "active", active_access: true, active_modules: ["whatsapp"] }));
    await renderScreen(<TicketScreen />);
    expect(await screen.findByRole("button", { name: "Enviar por WhatsApp" })).toBeTruthy();
  });

  it("sin el módulo, o si staff no puede ver la suscripción (403), no hay WhatsApp", async () => {
    await seedSession(staffUser, 10);
    serve(() => apiError(403, "Acceso denegado"));
    await renderScreen(<TicketScreen />);

    await screen.findByText("T-0042");
    expect(screen.queryByRole("button", { name: "Enviar por WhatsApp" })).toBeNull();
  });

  it("si falla la descarga lo dice", async () => {
    await seedSession(multiUser, 10);
    serve(() => reply(200, { status: "active", active_access: true, active_modules: [] }));
    mockDownload.mockRejectedValue(new Error("boom"));
    await renderScreen(<TicketScreen />);

    await fireEvent.press(await screen.findByRole("button", { name: "Descargar y compartir PDF" }));

    expect(await screen.findByText("No se pudo descargar el PDF.")).toBeTruthy();
  });
});
