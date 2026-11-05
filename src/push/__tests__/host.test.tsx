import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { clearStore, mockFetch, multiUser, reply, seedSession } from "@/test/helpers";
import { renderScreen } from "@/test/render";
import { PushHost } from "../host";
import { DEVICE_KEY } from "../registration";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.1.0", extra: { eas: { projectId: "proj-1" } } } }));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }));

type Mocked = {
  __setPushPermission: (p: unknown) => void;
  __emitNotification: (data: Record<string, unknown>, title?: string, body?: string) => void;
  __emitNotificationResponse: (data: Record<string, unknown>) => void;
  __setLastResponse: (data: Record<string, unknown> | null) => void;
};
const notifications = Notifications as unknown as Mocked;
const fetchMock = mockFetch();
const posts = () => fetchMock.mock.calls.filter(([url, init]) => init?.method === "POST" && String(url).endsWith("/push_devices"));
/** Espera a que el registro termine de guardarse, para que no se cuele en la prueba siguiente. */
const registered = () => waitFor(async () => expect(await SecureStore.getItemAsync(DEVICE_KEY)).not.toBeNull());

beforeEach(async () => {
  mockPush.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => reply(200, {}));
  notifications.__setPushPermission({ status: "undetermined", granted: false, canAskAgain: true });
  notifications.__setLastResponse(null);
  await clearStore();
  await SecureStore.deleteItemAsync(DEVICE_KEY);
  await SecureStore.deleteItemAsync(`draxuvo.push-asked.${multiUser.id}`);
  await seedSession(multiUser, 10);
});

describe("avisos push en la app (spec 057)", () => {
  it("con la app a la vista no dibuja la notificación del sistema", async () => {
    const handler = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0][0];
    await expect(handler.handleNotification()).resolves.toMatchObject({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false });
  });

  it("explica antes de pedir el permiso y «Ahora no» lo recuerda sin abrir el diálogo del sistema", async () => {
    await renderScreen(<PushHost />);

    expect(await screen.findByTestId("push-permission-sheet")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Ahora no" }));

    await waitFor(() => expect(screen.queryByTestId("push-permission-sheet")).toBeNull());
    await waitFor(async () => expect(await SecureStore.getItemAsync(`draxuvo.push-asked.${multiUser.id}`)).toBe("true"));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("la hoja sale una sola vez por persona", async () => {
    await SecureStore.setItemAsync(`draxuvo.push-asked.${multiUser.id}`, "true");
    await renderScreen(<PushHost />);
    await act(async () => {});

    expect(screen.queryByTestId("push-permission-sheet")).toBeNull();
  });

  it("«Activar» pide el permiso y registra el teléfono", async () => {
    await renderScreen(<PushHost />);

    await fireEvent.press(await screen.findByRole("button", { name: "Activar" }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    await registered();
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it("con permiso ya concedido registra al entrar, sin la hoja", async () => {
    notifications.__setPushPermission({ status: "granted", granted: true, canAskAgain: true });
    await renderScreen(<PushHost />);

    await waitFor(() => expect(posts()).toHaveLength(1));
    await registered();
    expect(screen.queryByTestId("push-permission-sheet")).toBeNull();
  });

  it("tocar un aviso de otra empresa cambia de empresa y abre la cuenta", async () => {
    notifications.__setPushPermission({ status: "granted", granted: true, canAskAgain: true });
    await renderScreen(<PushHost />);
    await waitFor(() => expect(posts()).toHaveLength(1));
    await registered();

    await act(async () => notifications.__emitNotificationResponse({ kind: "check_ready", company_id: 20, path: "/pedido?cuenta=7&hoja=1" }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/pedido?cuenta=7&hoja=1"));
    expect(JSON.parse((await SecureStore.getItemAsync("draxuvo.session"))!).companyId).toBe(20);
  });

  it("el aviso que abrió la app desde cerrada también se abre", async () => {
    notifications.__setPushPermission({ status: "granted", granted: true, canAskAgain: true });
    notifications.__setLastResponse({ kind: "check_ready", company_id: 10, path: "/pedido?cuenta=3&hoja=1" });

    await renderScreen(<PushHost />);

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/pedido?cuenta=3&hoja=1"));
    await registered();
  });

  it("en primer plano, comanda lista no duplica el aviso de la app y los demás salen como toast", async () => {
    notifications.__setPushPermission({ status: "granted", granted: true, canAskAgain: true });
    await renderScreen(<PushHost />);
    await waitFor(() => expect(posts()).toHaveLength(1));
    await registered();

    await act(async () => notifications.__emitNotification({ kind: "check_ready", company_id: 10, path: "/ordenes" }, "Volta · Comanda lista", "Mesa 4 · 2 artículos listos"));
    expect(screen.queryByText(/Mesa 4/)).toBeNull();

    await act(async () => notifications.__emitNotification({ kind: "low_stock", company_id: 10, path: "/alertas" }, "Volta · Stock bajo", "2 productos bajo el mínimo: Coca, Limón"));
    expect(await screen.findByText("Volta · Stock bajo: 2 productos bajo el mínimo: Coca, Limón")).toBeTruthy();
  });
});
