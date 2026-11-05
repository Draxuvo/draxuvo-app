import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { configureClient } from "@/api/client";
import { mockFetch, reply } from "@/test/helpers";
import { DEVICE_KEY, ensureRegistered, flushPendingUnregister, PENDING_KEY, REFRESH_MS, unregisterOnSignOut } from "../registration";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.1.0", extra: { eas: { projectId: "proj-1" } } } }));

const notifications = Notifications as unknown as { __setPushPermission: (p: unknown) => void };
const fetchMock = mockFetch();
const TOKEN = "ExponentPushToken[test-token-123456]";

const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => reply(200, {}));
  configureClient({ getToken: () => "jwt-now", getCompanyId: () => 10, getLocale: () => "es" });
  notifications.__setPushPermission({ status: "granted", granted: true, canAskAgain: true });
  await SecureStore.deleteItemAsync(DEVICE_KEY);
  await SecureStore.deleteItemAsync(PENDING_KEY);
});

describe("registro del teléfono (spec 057)", () => {
  it("registra token, plataforma, idioma y versión con el proyecto de EAS", async () => {
    expect(await ensureRegistered(1)).toBe(true);

    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "proj-1" });
    const [url, init] = calls("POST")[0];
    expect(url).toMatch(/\/api\/v1\/push_devices$/);
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN, platform: "ios", locale: "es", app_version: "1.1.0" });
    expect(init.headers["X-Company-Id"]).toBe("10");
  });

  it("no repite el registro antes de 12 h si nada cambió, y sí al cambiar de persona", async () => {
    await ensureRegistered(1, 1_000);
    await ensureRegistered(1, 1_000 + REFRESH_MS - 1);
    expect(calls("POST")).toHaveLength(1);

    await ensureRegistered(2, 2_000);
    await ensureRegistered(2, 2_000 + REFRESH_MS + 1);
    expect(calls("POST")).toHaveLength(3);
  });

  it("sin permiso no pide token ni registra", async () => {
    notifications.__setPushPermission({ status: "denied", granted: false, canAskAgain: false });

    expect(await ensureRegistered(1)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("al cerrar sesión da de baja el teléfono con el JWT que aún tiene", async () => {
    await ensureRegistered(1);
    fetchMock.mockClear();

    await unregisterOnSignOut({ jwt: "jwt-old", companyId: 10 });

    const [url, init] = calls("DELETE")[0];
    expect(url).toContain(encodeURIComponent(TOKEN));
    expect(init.headers.Authorization).toBe("Bearer jwt-old");
    expect(await SecureStore.getItemAsync(DEVICE_KEY)).toBeNull();
    expect(await SecureStore.getItemAsync(PENDING_KEY)).toBeNull();
    expect(Notifications.dismissAllNotificationsAsync).toHaveBeenCalled();
  });

  it("sin red deja la baja pendiente y la reintenta después; vencida se descarta", async () => {
    await ensureRegistered(1);
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));

    await unregisterOnSignOut({ jwt: "jwt-old", companyId: 10 }, 5_000);
    expect(JSON.parse((await SecureStore.getItemAsync(PENDING_KEY))!)).toMatchObject({ token: TOKEN, jwt: "jwt-old", companyId: 10 });

    fetchMock.mockClear();
    await flushPendingUnregister(6_000);
    expect(calls("DELETE")[0][1].headers.Authorization).toBe("Bearer jwt-old");
    expect(await SecureStore.getItemAsync(PENDING_KEY)).toBeNull();

    await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify({ token: TOKEN, jwt: "x", companyId: 10, savedAt: 0 }));
    fetchMock.mockClear();
    await flushPendingUnregister(25 * 60 * 60 * 1000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await SecureStore.getItemAsync(PENDING_KEY)).toBeNull();
  });

  it("un JWT rechazado no deja nada pendiente", async () => {
    await ensureRegistered(1);
    fetchMock.mockImplementationOnce(() => reply(401, { error: { status: 401, message: "x", details: null } }));

    await unregisterOnSignOut({ jwt: "jwt-expired", companyId: 10 });

    expect(await SecureStore.getItemAsync(PENDING_KEY)).toBeNull();
  });
});
