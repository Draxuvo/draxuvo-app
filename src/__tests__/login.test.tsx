import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import Login from "../../app/(auth)/login";
import { apiError, clearStore, mockFetch, reply, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));

const fetchMock = mockFetch();

beforeEach(async () => {
  fetchMock.mockReset();
  await clearStore();
});

const fill = async (email: string, password: string) => {
  await fireEvent.changeText(screen.getByTestId("login-email"), email);
  await fireEvent.changeText(screen.getByTestId("login-password"), password);
};

describe("pantalla de entrada", () => {
  it("pide correo y contraseña antes de llamar a la API", async () => {
    await renderScreen(<Login />);
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Escribe tu correo.")).toBeTruthy();
    expect(screen.getByText("Escribe tu contraseña.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un correo mal escrito", async () => {
    await renderScreen(<Login />);
    await fill("sin-arroba", "x");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Revisa el formato del correo.")).toBeTruthy();
  });

  it("credenciales malas muestran el mensaje de la API", async () => {
    fetchMock.mockReturnValue(apiError(401, "Contraseña incorrecta"));
    await renderScreen(<Login />);
    await fill("staff@volta.demo", "mal");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Contraseña incorrecta")).toBeTruthy();
  });

  it("una cuenta inactiva muestra su aviso", async () => {
    fetchMock.mockReturnValue(apiError(403, "Cuenta inactiva. Contacte al administrador."));
    await renderScreen(<Login />);
    await fill("staff@volta.demo", "x");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Cuenta inactiva. Contacte al administrador.")).toBeTruthy();
  });

  it("sin red avisa que no hay conexión", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await renderScreen(<Login />);
    await fill("staff@volta.demo", "x");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Sin conexión. Revisa tu red e intenta de nuevo.")).toBeTruthy();
  });

  it("una cuenta sin empresas explica qué hacer", async () => {
    fetchMock.mockReturnValue(reply(200, { token: "t", user: { ...staffUser, companies: [] } }));
    await renderScreen(<Login />);
    await fill("staff@volta.demo", "x");
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(screen.getByText(/no tiene ninguna empresa/)).toBeTruthy());
  });
});
