import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { Linking } from "react-native";
import { MyNotifications } from "@/components/push/my-notifications";
import { clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.1.0", extra: { eas: { projectId: "proj-1" } } } }));

const notifications = Notifications as unknown as { __setPushPermission: (p: unknown) => void };
const fetchMock = mockFetch();
let preference: Record<string, unknown>;

beforeEach(async () => {
  fetchMock.mockReset();
  preference = { available: ["check_ready", "work_order_assigned"], check_ready: true, work_order_assigned: true };
  fetchMock.mockImplementation((url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === "PATCH") {
      preference = { ...preference, ...JSON.parse(init.body!) };
      return reply(200, preference);
    }
    return reply(200, preference);
  });
  notifications.__setPushPermission({ status: "granted", granted: true, canAskAgain: true });
  await clearStore();
  await seedSession(staffUser, 10);
});

describe("Mis avisos (spec 057, US2)", () => {
  it("muestra un interruptor por cada tipo que le toca a la persona", async () => {
    await renderScreen(<MyNotifications />);

    expect(await screen.findByRole("switch", { name: "Comanda lista" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Orden asignada" })).toBeTruthy();
    expect(screen.queryByRole("switch", { name: "Stock bajo" })).toBeNull();
  });

  it("apagar un tipo lo guarda para la empresa activa", async () => {
    await renderScreen(<MyNotifications />);

    await fireEvent(await screen.findByRole("switch", { name: "Comanda lista" }), "valueChange", false);

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
    const [url, init] = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH")!;
    expect(url).toMatch(/\/api\/v1\/push_preference$/);
    expect(JSON.parse(init.body)).toEqual({ check_ready: false });
    expect(init.headers["X-Company-Id"]).toBe("10");
  });

  it("con los avisos bloqueados en el teléfono lo dice y ofrece abrir los ajustes", async () => {
    notifications.__setPushPermission({ status: "denied", granted: false, canAskAgain: false });
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await renderScreen(<MyNotifications />);

    expect(await screen.findByText(/Los avisos están desactivados en este teléfono/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Abrir ajustes" }));
    expect(openSettings).toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Comanda lista" })).toBeTruthy();
  });
});
