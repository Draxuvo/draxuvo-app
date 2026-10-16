import { ApiError, api, configureClient, NetworkError } from "../client";

jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));

const fetchMock = jest.fn();
Object.defineProperty(global, "fetch", { value: fetchMock, writable: true, configurable: true });

const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(JSON.stringify(body)) });

beforeEach(() => {
  fetchMock.mockReset();
  configureClient({ getToken: () => "tok", getCompanyId: () => 7, getLocale: () => "en", onUnauthorized: jest.fn() });
});

describe("cliente HTTP", () => {
  it("manda token, empresa, idioma y versión", async () => {
    fetchMock.mockReturnValue(reply(200, { ok: true }));
    await api.get("/api/v1/work_orders", { query: { page: 2, status: undefined } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/work_orders\?page=2$/);
    expect(init.headers).toMatchObject({
      Authorization: "Bearer tok",
      "X-Company-Id": "7",
      locale: "en",
      "X-App-Version": "1.0.0 ios",
    });
  });

  it("convierte el error de la API en ApiError con su forma", async () => {
    fetchMock.mockReturnValue(reply(403, { error: { status: 403, message: "No", details: { code: "module_not_in_plan" } } }));
    const error = (await api.get("/x").catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
    expect(error.code).toBe("module_not_in_plan");
  });

  it("un 401 avisa para cerrar la sesión, salvo en el login", async () => {
    const onUnauthorized = jest.fn();
    configureClient({ onUnauthorized });
    fetchMock.mockReturnValue(reply(401, { error: { status: 401, message: "x", details: null } }));
    await api.get("/x").catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await api.post("/api/v1/auth/login", { skipUnauthorized: true }).catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("sin red lanza NetworkError", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await expect(api.get("/x")).rejects.toBeInstanceOf(NetworkError);
  });

  it("una petición colgada se corta a los 30 s como NetworkError", async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))));
      const pending = api.get("/x").catch((e: unknown) => e);
      jest.advanceTimersByTime(30_000);
      expect(await pending).toBeInstanceOf(NetworkError);
    } finally {
      jest.useRealTimers();
    }
  });
});
