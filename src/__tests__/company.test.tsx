import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import Empresa from "../../app/empresa";
import { apiError, clearStore, mockFetch, multiUser, reply, seedSession } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ Stack: { Screen: () => null }, useRouter: () => ({ replace: mockReplace }) }));

const fetchMock = mockFetch();

/** Cada empresa responde según su X-Company-Id. */
function serve(byCompany: Record<string, () => Promise<unknown>>) {
  fetchMock.mockImplementation((_url: string, init: { headers: Record<string, string> }) => byCompany[init.headers["X-Company-Id"]]());
}

beforeEach(async () => {
  fetchMock.mockReset();
  mockReplace.mockReset();
  await clearStore();
  await seedSession(multiUser, 10);
});

describe("elegir empresa", () => {
  it("lista cada empresa con el rol que tiene en ella", async () => {
    serve({ "10": () => reply(200, {}), "20": () => reply(200, {}) });
    await renderScreen(<Empresa />);

    expect(await screen.findByRole("button", { name: /Volta, Dueño, Activa/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sazón, Staff/ })).toBeTruthy();
  });

  it("avisa de la suscripción vencida y del plan sin órdenes", async () => {
    serve({
      "10": () => apiError(403, "La suscripción no está activa"),
      "20": () => apiError(403, { code: "module_not_in_plan", module: "work_orders" }),
    });
    await renderScreen(<Empresa />);

    expect(await screen.findByText("Suscripción vencida: no podrás ver sus órdenes.")).toBeTruthy();
    expect(await screen.findByText("Su plan no incluye el módulo de órdenes.")).toBeTruthy();
  });

  it("cambiar de empresa cambia la empresa activa (y con ella el rol) y vuelve a la lista", async () => {
    serve({ "10": () => reply(200, {}), "20": () => reply(200, {}) });
    const { client } = await renderScreen(<Empresa />);
    await screen.findByRole("button", { name: /Volta/ });
    client.setQueryData(["company", 10, "orders", {}], { stale: true });

    await fireEvent.press(screen.getByRole("button", { name: /Sazón/ }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)/ordenes"));
    expect(client.getQueryData(["company", 10, "orders", {}])).toBeUndefined();
    expect(JSON.parse((await SecureStore.getItemAsync("draxuvo.session")) as string).companyId).toBe(20);
  });
});
