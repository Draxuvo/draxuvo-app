import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import { Linking, Text } from "react-native";
import { AppGate } from "@/gates/app-gate";
import { api } from "@/api/client";
import { apiError, clearStore, mockFetch, multiUser, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }), useSegments: () => ["(tabs)"] }));
jest.mock("@/gates/version", () => ({ mustUpdate: () => Promise.resolve(false) }));

const fetchMock = mockFetch();

const suspended = {
  code: "subscription_suspended",
  reason: "plan_change",
  plan: "pro",
  cancels_at: "2026-11-21T10:00:00Z",
  pay_url: "https://invoice.stripe.com/i/app",
};

/** Una pantalla cualquiera que hace una petición de operación: la API responde según lo preparado. */
function Operation() {
  useEffect(() => {
    void api.get("/api/v1/work_orders").catch(() => {});
  }, []);
  return <Text>Órdenes de trabajo</Text>;
}

beforeEach(async () => {
  fetchMock.mockReset();
  await clearStore();
});

describe("empresa suspendida por falta de pago (spec 031)", () => {
  it("un 403 subscription_suspended reemplaza la operación por la pantalla de suspensión", async () => {
    await seedSession(staffUser, 10);
    fetchMock.mockImplementation(() => apiError(403, suspended, "suspendida"));
    await renderScreen(
      <AppGate>
        <Operation />
      </AppGate>,
    );

    expect(await screen.findByText("Suscripción suspendida")).toBeTruthy();
    expect(screen.queryByText("Órdenes de trabajo")).toBeNull();
    expect(screen.getByText(/Avisa al dueño de la cuenta/)).toBeTruthy();
    // El personal no ve el botón de pago.
    expect(screen.queryByText("Pagar ahora")).toBeNull();
  });

  it("el dueño ve el plan pendiente y Pagar ahora abre la factura", async () => {
    const owner = { ...multiUser, companies: [{ ...multiUser.companies[0] }] };
    await seedSession(owner, 10);
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    fetchMock.mockImplementation(() => apiError(403, suspended, "suspendida"));
    await renderScreen(
      <AppGate>
        <Operation />
      </AppGate>,
    );

    expect(await screen.findByText("Plan pendiente de pago: pro")).toBeTruthy();
    await fireEvent.press(screen.getByText("Pagar ahora"));

    expect(open).toHaveBeenCalledWith("https://invoice.stripe.com/i/app");
  });

  it("Ya pagué vuelve a preguntar y, si la API ya deja pasar, se desbloquea", async () => {
    await seedSession(staffUser, 10);
    let paid = false;
    fetchMock.mockImplementation(() => (paid ? reply(200, { id: 10 }) : apiError(403, suspended, "suspendida")));
    await renderScreen(
      <AppGate>
        <Operation />
      </AppGate>,
    );
    await screen.findByText("Suscripción suspendida");

    await fireEvent.press(screen.getByText("Ya pagué"));
    expect(await screen.findByText(/Todavía no vemos el pago/)).toBeTruthy();

    paid = true;
    await fireEvent.press(screen.getByText("Ya pagué"));
    await waitFor(() => expect(screen.queryByText("Suscripción suspendida")).toBeNull());
    expect(screen.getByText("Órdenes de trabajo")).toBeTruthy();
  });

  it("otro 403 (por ejemplo un módulo fuera del plan) no dispara la pantalla", async () => {
    await seedSession(staffUser, 10);
    fetchMock.mockImplementation(() => apiError(403, { code: "module_not_in_plan", module: "tickets" }, "módulo"));
    await renderScreen(
      <AppGate>
        <Operation />
      </AppGate>,
    );

    expect(await screen.findByText("Órdenes de trabajo")).toBeTruthy();
    expect(screen.queryByText("Suscripción suspendida")).toBeNull();
  });
});
