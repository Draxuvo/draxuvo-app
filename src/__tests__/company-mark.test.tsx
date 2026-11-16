import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { CompanyLogo } from "@/components/company-mark";
import { AppGate } from "@/gates/app-gate";
import { apiError, clearStore, mockFetch, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-image", () => {
  const { View } = jest.requireActual("react-native");
  return { Image: (props: Record<string, unknown>) => <View testID="company-logo-image" {...props} /> };
});
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }), useSegments: () => ["(tabs)"] }));
jest.mock("@/gates/version", () => ({ mustUpdate: () => Promise.resolve(false) }));

const fetchMock = mockFetch();

beforeEach(async () => {
  fetchMock.mockReset();
  await clearStore();
});

// Spec 063 (US2): la app muestra la marca de la empresa, no la de Draxuvo.
describe("CompanyLogo", () => {
  it("muestra el logo de la empresa", async () => {
    await renderScreen(<CompanyLogo company={{ name: "Aquí me quedo", logo_url: "https://api.test/logo.webp" }} />);
    const image = screen.getByTestId("company-logo-image");
    expect(image.props.source).toEqual({ uri: "https://api.test/logo.webp" });
    expect(image.props.accessibilityLabel).toBe("Logo de Aquí me quedo");
  });

  it("sin logo muestra la inicial", async () => {
    await renderScreen(<CompanyLogo company={{ name: "Aquí me quedo", logo_url: null }} />);
    expect(screen.queryByTestId("company-logo-image")).toBeNull();
    expect(screen.getByText("AM")).toBeTruthy();
  });

  it("si el logo no carga cae a la inicial", async () => {
    await renderScreen(<CompanyLogo company={{ name: "Volta", logo_url: "https://api.test/roto.webp" }} />);
    await fireEvent(screen.getByTestId("company-logo-image"), "error");
    expect(screen.queryByTestId("company-logo-image")).toBeNull();
    expect(screen.getByText("V")).toBeTruthy();
  });
});

describe("pantalla de empresa suspendida", () => {
  it("se identifica con el logo de la empresa, no con la marca Draxuvo", async () => {
    const user = { ...staffUser, companies: [{ ...staffUser.companies[0], logo_url: "https://api.test/volta.webp" }] };
    await seedSession(user, 10);
    fetchMock.mockImplementation(() =>
      apiError(403, { code: "subscription_suspended", reason: "plan_change", plan: "pro", cancels_at: null, pay_url: null }, "suspendida"),
    );
    const { api } = jest.requireActual("@/api/client");
    await renderScreen(<AppGate>{null}</AppGate>);
    void api.get("/api/v1/work_orders").catch(() => {});

    await waitFor(() => expect(screen.getByText("Suscripción suspendida")).toBeTruthy());
    expect(screen.getByTestId("company-logo-image").props.source).toEqual({ uri: "https://api.test/volta.webp" });
    expect(screen.queryByText("Draxuvo")).toBeNull();
  });
});
