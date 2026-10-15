import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { createElement, type PropsWithChildren } from "react";
import { request } from "@/api/client";
import { apiError, clearStore, mockFetch, multiUser, reply, seedSession, staffUser } from "@/test/helpers";
import { NoCompanyError, SessionProvider, useSession } from "..";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));

const wrapper = ({ children }: PropsWithChildren) => createElement(SessionProvider, null, children);
const fetchMock = mockFetch();

beforeEach(async () => {
  fetchMock.mockReset();
  await clearStore();
  (LocalAuthentication.authenticateAsync as jest.Mock).mockClear();
  (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(false);
  (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
  (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
});

describe("sesión", () => {
  it("sin sesión guardada arranca en signedOut", async () => {
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("signedOut"));
  });

  it("reabrir la app restaura la sesión sin pedir la contraseña", async () => {
    await seedSession(staffUser, 10);
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("signedIn"));
    expect(result.current.role).toBe("staff");
    expect(result.current.companyId).toBe(10);
  });

  it("iniciar sesión guarda token, usuario y la primera empresa", async () => {
    fetchMock.mockReturnValue(reply(200, { token: "abc", user: staffUser }));
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("signedOut"));

    await act(() => result.current.signIn("Staff@Volta.demo ", "Demo12345*"));

    expect(result.current.status).toBe("signedIn");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).email).toBe("staff@volta.demo");
    expect(JSON.parse((await SecureStore.getItemAsync("draxuvo.session"))!).token).toBe("abc");
  });

  it("una cuenta sin empresas no entra", async () => {
    fetchMock.mockReturnValue(reply(200, { token: "abc", user: { ...staffUser, companies: [] } }));
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("signedOut"));

    await expect(act(() => result.current.signIn("a@b.co", "x"))).rejects.toBeInstanceOf(NoCompanyError);
    expect(result.current.status).toBe("signedOut");
  });

  it("un 401 en cualquier petición cierra la sesión y borra lo guardado", async () => {
    await seedSession(staffUser, 10);
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("signedIn"));

    fetchMock.mockReturnValue(apiError(401));
    await act(async () => {
      await request("GET", "/api/v1/work_orders").catch(() => {});
    });

    expect(result.current.status).toBe("signedOut");
    expect(await SecureStore.getItemAsync("draxuvo.session")).toBeNull();
  });

  it("credenciales malas en el login no cierran una sesión ni la crean", async () => {
    fetchMock.mockReturnValue(apiError(401, "Contraseña incorrecta"));
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("signedOut"));

    await expect(act(() => result.current.signIn("a@b.co", "mal"))).rejects.toMatchObject({ status: 401 });
    expect(result.current.status).toBe("signedOut");
  });

  it("cambiar de empresa cambia la empresa activa y el rol", async () => {
    await seedSession(multiUser, 10);
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("signedIn"));
    expect(result.current.role).toBe("owner");

    await act(() => result.current.setCompany(20));
    expect(result.current.role).toBe("staff");
  });
});

describe("biometría opcional", () => {
  const enroll = () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
  };

  it("con biometría activa la sesión abre bloqueada hasta confirmar", async () => {
    enroll();
    await seedSession(staffUser, 10, true);
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("locked"));

    await act(() => result.current.unlock());
    expect(result.current.status).toBe("signedIn");
  });

  it("tras tres fallos no desbloquea y queda para la contraseña", async () => {
    enroll();
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false, error: "authentication_failed" });
    await seedSession(staffUser, 10, true);
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("locked"));

    let ok = true;
    await act(async () => {
      ok = await result.current.unlock();
    });
    expect(ok).toBe(false);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("locked");
  });

  it("sin huella o rostro en el teléfono no se bloquea aunque estuviera activa", async () => {
    await seedSession(staffUser, 10, true);
    const { result } = await renderHook(useSession, { wrapper });
    await waitFor(() => expect(result.current.status).toBe("signedIn"));
  });
});
