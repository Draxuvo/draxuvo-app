import type { ErrorEvent } from "@sentry/react-native";

type SentryMock = typeof import("@sentry/react-native");
let Sentry: SentryMock;

// Spec 071: sin DSN la app no inicializa Sentry; con DSN, sin datos personales, capturas ni tracing, y solo ids.
describe("monitoring", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  // Cada prueba carga el módulo de cero (estado `initialized`) junto con su instancia del mock de Sentry.
  function load() {
    /* eslint-disable @typescript-eslint/no-require-imports */
    Sentry = require("@sentry/react-native") as SentryMock;
    return require("../monitoring") as typeof import("../monitoring");
    /* eslint-enable @typescript-eslint/no-require-imports */
  }

  it("sin DSN no inicializa ni fija usuario o pantalla", () => {
    const m = load();
    expect(m.initMonitoring("")).toBe(false);
    m.setMonitoringUser(42, 23);
    m.setMonitoringScreen("/cuenta/5");
    expect(m.isMonitoringActive()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.setUser).not.toHaveBeenCalled();
    expect(Sentry.setTag).not.toHaveBeenCalled();
  });

  it("con DSN inicializa una vez, sin PII, capturas ni tracing", () => {
    const m = load();
    expect(m.initMonitoring("https://abc@o1.ingest.sentry.io/1")).toBe(true);
    expect(m.initMonitoring("https://abc@o1.ingest.sentry.io/1")).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(jest.mocked(Sentry.init).mock.calls[0][0]).toMatchObject({
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      tracesSampleRate: 0,
    });
  });

  it("fija solo ids de usuario y empresa, y la pantalla sin query", () => {
    const m = load();
    m.initMonitoring("https://abc@o1.ingest.sentry.io/1");

    m.setMonitoringUser(42, 23);
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: "42" });
    expect(Sentry.setTag).toHaveBeenCalledWith("company_id", "23");

    m.setMonitoringScreen("/pedido?cuenta=5");
    expect(Sentry.setTag).toHaveBeenLastCalledWith("screen", "/pedido");

    m.setMonitoringUser(null, null);
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
  });

  it("beforeSend y beforeBreadcrumb quitan datos personales, query y la consola", () => {
    const m = load();
    const event = {
      request: { url: "https://api.draxuvo.com/api/v1/x?search=Juan", query_string: "search=Juan", headers: { Authorization: "Bearer jwt" } },
      user: { id: "42", email: "mesero@negocio.mx", ip_address: "187.0.0.1" },
    } as unknown as ErrorEvent;

    const dumped = JSON.stringify(m.beforeSend(event));
    for (const secret of ["Juan", "Bearer", "mesero@negocio.mx", "187.0.0.1"]) expect(dumped).not.toContain(secret);
    expect(event.user).toEqual({ id: "42" });

    expect(m.beforeBreadcrumb({ category: "xhr", data: { url: "https://api.draxuvo.com/a?b=c" } })?.data?.url).toBe("https://api.draxuvo.com/a");
    expect(m.beforeBreadcrumb({ category: "console", message: "x" })).toBeNull();
  });
});
