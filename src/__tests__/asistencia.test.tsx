import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import Perfil from "../../app/(tabs)/perfil";
import type { MyAttendance, Shift } from "@/api/attendance";
import { clearPrompted } from "@/attendance/prompted";
import { AttendanceCard } from "@/components/attendance/attendance-card";
import { EntryModal } from "@/components/attendance/entry-modal";
import { useLogoutFlow } from "@/components/attendance/logout-modal";
import { setLocale } from "@/i18n";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";
import { resetToasts } from "@/toast/store";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const fetchMock = mockFetch();

const shift: Shift = { id: 1, checkin_at: "2026-10-20T15:00:00Z", checkout_at: null, open: true, duration_minutes: null };
const closed: Shift = { ...shift, checkout_at: "2026-10-20T23:00:00Z", open: false, duration_minutes: 480 };
const status = (over: Partial<MyAttendance> = {}): MyAttendance => ({ eligible: true, state: "none", current: null, last: null, server_time: "2026-10-20T15:00:00Z", ...over });

/** Responde a /my_attendance/* con el estado dado; `onCall` ve cada POST. */
function serve(initial: MyAttendance, after: Partial<Record<"check_in" | "check_out", MyAttendance | "fail">> = {}) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/my_attendance/today")) return reply(200, initial);
    const action = path.split("/").pop() as "check_in" | "check_out";
    const next = after[action];
    if (next === "fail") return apiError(500, null, "boom");
    return reply(action === "check_in" && init?.method === "POST" ? 201 : 200, next ?? initial);
  });
}

const posts = (action: string) => fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(`/my_attendance/${action}`) && init?.method === "POST");

beforeEach(async () => {
  fetchMock.mockReset();
  clearPrompted();
  await setLocale("es");
  await clearStore();
  await seedSession(staffUser, 10);
});

afterEach(() => resetToasts());

describe("modal de entrada", () => {
  it("aparece sin entrada y marcar crea el turno", async () => {
    serve(status(), { check_in: status({ state: "working", current: shift }) });
    await renderScreen(<EntryModal />);

    fireEvent.press(await screen.findByRole("button", { name: "Marcar entrada" }));

    await waitFor(() => expect(posts("check_in")).toHaveLength(1));
    expect(await screen.findByText("Entrada marcada")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Ahora no")).toBeNull());
  });

  it("Ahora no lo omite sin marcar y no vuelve a salir en la sesión", async () => {
    serve(status());
    const first = await renderScreen(<EntryModal />);

    fireEvent.press(await screen.findByRole("button", { name: "Ahora no" }));

    expect(posts("check_in")).toHaveLength(0);
    await waitFor(() => expect(screen.queryByText("Ahora no")).toBeNull());
    await first.unmount();

    await renderScreen(<EntryModal />);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    expect(screen.queryByText("Ahora no")).toBeNull();
  });

  it("no aparece con una entrada abierta ni si la persona no es empleada", async () => {
    serve(status({ state: "working", current: shift }));
    const open = await renderScreen(<EntryModal />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("Ahora no")).toBeNull();
    await open.unmount();

    fetchMock.mockReset();
    serve(status({ eligible: false }));
    await renderScreen(<EntryModal />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("Ahora no")).toBeNull();
  });

  it("también aparece si ya marcó una salida hoy (sin entrada abierta)", async () => {
    serve(status({ state: "done", last: closed }));
    await renderScreen(<EntryModal />);

    expect(await screen.findByRole("button", { name: "Marcar entrada" })).toBeTruthy();
  });

  it("si marcar falla avisa y deja el modal abierto", async () => {
    serve(status(), { check_in: "fail" });
    await renderScreen(<EntryModal />);

    fireEvent.press(await screen.findByRole("button", { name: "Marcar entrada" }));

    await waitFor(() => expect(posts("check_in")).toHaveLength(1));
    expect(screen.getByText("Ahora no")).toBeTruthy();
  });
});

describe("tarjeta de asistencia", () => {
  it("sin entrada muestra Marcar entrada y al marcar pasa a En turno", async () => {
    serve(status(), { check_in: status({ state: "working", current: shift }) });
    await renderScreen(<AttendanceCard />);

    expect(await screen.findByText("Sin entrada hoy")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Marcar entrada" }));

    expect(await screen.findByText(/En turno desde las/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Marcar salida" })).toBeTruthy();
  });

  it("si la API dice que ya no hay turno abierto, vuelve a pedir el estado", async () => {
    let current = status({ state: "working", current: shift });
    fetchMock.mockImplementation((url: string) => {
      if (new URL(url).pathname.endsWith("/my_attendance/today")) return reply(200, current);
      current = status({ state: "done", last: closed }); // otro dispositivo cerró el turno antes
      return apiError(422, null, "Sin entrada abierta");
    });
    await renderScreen(<AttendanceCard />);

    fireEvent.press(await screen.findByRole("button", { name: "Marcar salida" }));

    expect(await screen.findByText(/Salida marcada a las/)).toBeTruthy();
  });

  it("sin red al marcar no vuelve a pedir el estado y sigue En turno", async () => {
    let todayCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (new URL(url).pathname.endsWith("/my_attendance/today")) {
        todayCalls += 1;
        return reply(200, status({ state: "working", current: shift }));
      }
      return Promise.reject(new TypeError("Network request failed"));
    });
    await renderScreen(<AttendanceCard />);

    fireEvent.press(await screen.findByRole("button", { name: "Marcar salida" }));

    expect(await screen.findByText("Sin conexión. Revisa tu red e intenta de nuevo.")).toBeTruthy();
    expect(todayCalls).toBe(1);
    expect(screen.getByText(/En turno desde las/)).toBeTruthy();
  });

  it("en turno marca la salida y queda Salida marcada", async () => {
    serve(status({ state: "working", current: shift }), { check_out: status({ state: "done", last: closed }) });
    await renderScreen(<AttendanceCard />);

    fireEvent.press(await screen.findByRole("button", { name: "Marcar salida" }));

    expect(await screen.findByText(/Salida marcada a las/)).toBeTruthy();
    expect(posts("check_out")).toHaveLength(1);
  });

  it("no se pinta si la persona no es empleada o si no se pudo consultar", async () => {
    serve(status({ eligible: false }));
    const a = await renderScreen(<AttendanceCard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("Asistencia")).toBeNull();
    await a.unmount();

    fetchMock.mockReset();
    fetchMock.mockReturnValue(apiError(403, { code: "module_not_in_plan" }, "sin módulo"));
    await renderScreen(<AttendanceCard />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("Asistencia")).toBeNull();
  });

  it("aparece en el perfil", async () => {
    serve(status());
    await renderScreen(<Perfil />);
    expect(await screen.findByText("Sin entrada hoy")).toBeTruthy();
  });
});

function LogoutHarness() {
  const { requestLogout, modal } = useLogoutFlow();
  return (
    <>
      <Text accessibilityRole="button" onPress={requestLogout}>
        Salir
      </Text>
      {modal}
    </>
  );
}

describe("cerrar sesión", () => {
  it("sin turno abierto cierra directo", async () => {
    serve(status());
    await renderScreen(<LogoutHarness />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fireEvent.press(screen.getByText("Salir"));

    expect(screen.queryByText("¿Marcas tu salida?")).toBeNull();
  });

  it("con turno abierto ofrece las tres opciones y Cancelar no cierra", async () => {
    serve(status({ state: "working", current: shift }));
    await renderScreen(<LogoutHarness />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await screen.findByText("Salir");
    await new Promise((resolve) => setTimeout(resolve, 20));

    fireEvent.press(screen.getByText("Salir"));

    expect(await screen.findByText("¿Marcas tu salida?")).toBeTruthy();
    expect(screen.getByText("Marcar salida y cerrar sesión")).toBeTruthy();
    expect(screen.getByText("Cerrar sin marcar")).toBeTruthy();
    fireEvent.press(screen.getByText("Cancelar"));
    await waitFor(() => expect(screen.queryByText("¿Marcas tu salida?")).toBeNull());
    expect(posts("check_out")).toHaveLength(0);
  });

  it("Marcar salida y cerrar sesión marca primero; si falla no cierra", async () => {
    serve(status({ state: "working", current: shift }), { check_out: "fail" });
    await renderScreen(<LogoutHarness />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));

    fireEvent.press(screen.getByText("Salir"));
    fireEvent.press(await screen.findByText("Marcar salida y cerrar sesión"));

    await waitFor(() => expect(posts("check_out")).toHaveLength(1));
    expect(screen.getByText("¿Marcas tu salida?")).toBeTruthy();
  });
});
