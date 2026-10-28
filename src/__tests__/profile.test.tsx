import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import Perfil from "../../app/(tabs)/perfil";
import { getLocale, setLocale } from "@/i18n";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
// La asistencia (spec 026) se prueba aparte; aquí no debe hacer peticiones que cuenten como llamadas del perfil.
jest.mock("@/hooks/use-attendance", () => ({
  useAttendance: () => ({ data: undefined, eligible: false, state: undefined, markIn: { mutate: jest.fn() }, markOut: { mutate: jest.fn() } }),
}));
const mockPick = jest.fn();
const mockPrepare = jest.fn();
jest.mock("@/lib/image", () => {
  class NotAnImageError extends Error {}
  class ImageTooLargeError extends Error {}
  class PermissionDeniedError extends Error {
    source = "camera";
  }
  return {
    NotAnImageError,
    ImageTooLargeError,
    PermissionDeniedError,
    pickImage: (...a: unknown[]) => mockPick(...a),
    prepareImage: (...a: unknown[]) => mockPrepare(...a),
  };
});

const fetchMock = mockFetch();

beforeEach(async () => {
  fetchMock.mockReset();
  mockPick.mockReset();
  mockPrepare.mockReset();
  await setLocale("es");
  await clearStore();
  await seedSession(staffUser, 10);
});

describe("perfil", () => {
  it("muestra el sonido de comanda lista y abre la hoja para cambiarlo (spec 046)", async () => {
    await renderScreen(<Perfil />);

    fireEvent.press(await screen.findByLabelText("Sonido de comanda lista: Clásico"));

    expect(await screen.findByRole("radio", { name: "Campana" })).toBeTruthy();
  });

  it("muestra correo y rol sin poder editarlos", async () => {
    await renderScreen(<Perfil />);

    const email = await screen.findByDisplayValue("staff@volta.demo");
    expect(email.props.editable).toBe(false);
    expect(screen.getByDisplayValue("Staff").props.editable).toBe(false);
  });

  it("guarda nombre y teléfono", async () => {
    fetchMock.mockReturnValue(reply(200, { ...staffUser, first_name: "Sara Luz", phone: "5512345678" }));
    await renderScreen(<Perfil />);

    await fireEvent.changeText(await screen.findByTestId("profile-first-name"), "Sara Luz");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Cambios guardados.")).toBeTruthy();
    const call = fetchMock.mock.calls[0];
    expect(call[1].method).toBe("PATCH");
    expect(JSON.parse(call[1].body).profile.first_name).toBe("Sara Luz");
    expect(JSON.parse((await SecureStore.getItemAsync("draxuvo.session")) as string).user.first_name).toBe("Sara Luz");
  });

  it("no guarda sin nombre", async () => {
    await renderScreen(<Perfil />);

    await fireEvent.changeText(await screen.findByTestId("profile-first-name"), " ");
    await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Escribe tu nombre.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sube la foto de perfil desde la galería", async () => {
    mockPick.mockResolvedValue({ uri: "file:///a.heic" });
    mockPrepare.mockResolvedValue({ uri: "file:///a.jpg", name: "a.jpg", type: "image/jpeg" });
    fetchMock.mockReturnValue(reply(200, { ...staffUser, avatar_url: "https://x/a.jpg" }));
    await renderScreen(<Perfil />);

    await fireEvent.press(await screen.findByRole("button", { name: "Galería" }));

    await waitFor(() => expect(fetchMock.mock.calls[0][0]).toMatch(/\/profile\/avatar$/));
    expect(await screen.findByRole("button", { name: "Quitar foto" })).toBeTruthy();
  });

  it("rechaza un archivo que no es imagen y muestra el motivo", async () => {
    const { NotAnImageError } = jest.requireMock("@/lib/image");
    mockPick.mockResolvedValue({ uri: "file:///a.pdf" });
    mockPrepare.mockRejectedValue(new NotAnImageError());
    await renderScreen(<Perfil />);

    await fireEvent.press(await screen.findByRole("button", { name: "Galería" }));

    expect(await screen.findByText("Solo se pueden subir imágenes.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra el error de la API al guardar", async () => {
    fetchMock.mockReturnValue(apiError(422, ["Teléfono inválido"]));
    await renderScreen(<Perfil />);

    await fireEvent.changeText(await screen.findByTestId("profile-first-name"), "Sara");
    await fireEvent.press(await screen.findByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Teléfono inválido")).toBeTruthy();
  });

  it("cambia el idioma y lo guarda en el dispositivo", async () => {
    await renderScreen(<Perfil />);

    await fireEvent.press(await screen.findByRole("radio", { name: "English" }));

    expect(getLocale()).toBe("en");
    expect(await screen.findByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(await SecureStore.getItemAsync("draxuvo.locale")).toBe("en");
  });
});
