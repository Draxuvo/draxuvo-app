import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import AsistenciaEquipo from "../../app/asistencia-equipo";
import Perfil from "../../app/(tabs)/perfil";
import type { RosterRow } from "@/api/attendance";
import { setLocale } from "@/i18n";
import { apiError, clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";
import { resetToasts } from "@/toast/store";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }), Stack: { Screen: () => null } }));

const fetchMock = mockFetch();

const asRole = (role: "admin" | "owner" | "staff") => ({
  ...staffUser,
  role,
  companies: [{ ...staffUser.companies[0], role }],
});

const shift = (over = {}) => ({
  id: 1, checkin_at: "2026-10-20T15:00:00Z", checkout_at: null, open: true, duration_minutes: null,
  checkin_by: null, checkout_by: null, checkin_captured: false, checkout_captured: false, ...over,
});
const rows: RosterRow[] = [
  { employee: { id: 1, name: "Ana Ruiz", position: null }, state: "none", attendance: null },
  { employee: { id: 2, name: "Luis Pérez", position: null }, state: "working", attendance: shift() },
  { employee: { id: 3, name: "Zoe Cierre", position: null }, state: "done", attendance: shift({ checkout_at: "2026-10-20T23:00:00Z", open: false, checkin_captured: true, checkin_by: { id: 9, name: "Dueño" } }) },
];

const marks = (action: string) => fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(`/${action}`) && init?.method === "POST");

function serve() {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/attendances/roster")) return reply(200, { date: "2026-10-20", results: rows });
    if (init?.method === "POST") return reply(201, shift());
    return reply(200, {});
  });
}

beforeEach(async () => {
  fetchMock.mockReset();
  await setLocale("es");
  await clearStore();
});

afterEach(() => resetToasts());

describe("Asistencia del equipo (spec 036)", () => {
  it("lista a cada empleado con su estado y las acciones que le tocan", async () => {
    await seedSession(asRole("admin"), 10);
    serve();
    await renderScreen(<AsistenciaEquipo />);

    expect(await screen.findByText("Ana Ruiz")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Marcar entrada" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Marcar salida" })).toHaveLength(1);
    expect(screen.getByText(/capturada por Dueño/)).toBeTruthy();
  });

  it("marca la entrada con la hora actual sin mandar `at`", async () => {
    await seedSession(asRole("owner"), 10);
    serve();
    await renderScreen(<AsistenciaEquipo />);

    fireEvent.press((await screen.findAllByRole("button", { name: "Marcar entrada" }))[0]);
    await screen.findByText("Entrada de Ana Ruiz");
    fireEvent.press(screen.getAllByRole("button", { name: "Marcar entrada" }).at(-1)!);

    await waitFor(() => expect(marks("employees/1/checkin")).toHaveLength(1));
    expect(JSON.parse(marks("employees/1/checkin")[0][1].body).at).toBeUndefined();
    expect(await screen.findByText("Entrada de Ana Ruiz registrada")).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/attendances/roster"))).toHaveLength(2));
  });

  it("rechaza una hora futura sin llamar a la API", async () => {
    await seedSession(asRole("admin"), 10);
    serve();
    await renderScreen(<AsistenciaEquipo />);

    fireEvent.press((await screen.findAllByRole("button", { name: "Marcar entrada" }))[0]);
    fireEvent.changeText(await screen.findByLabelText("Fecha (AAAA-MM-DD)"), "2999-01-01");
    fireEvent.press((await screen.findAllByRole("button", { name: "Marcar entrada" })).at(-1)!);

    expect(await screen.findByText("La hora no puede ser futura.")).toBeTruthy();
    expect(marks("employees/1/checkin")).toHaveLength(0);
  });

  it("muestra el mensaje de la API cuando la marca se rechaza", async () => {
    await seedSession(asRole("admin"), 10);
    fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
      new URL(url).pathname.endsWith("/roster")
        ? reply(200, { date: "2026-10-20", results: rows })
        : init?.method === "POST"
          ? apiError(422, { code: "already_open" }, "Ya tiene una entrada registrada sin salida")
          : reply(200, {}),
    );
    await renderScreen(<AsistenciaEquipo />);

    fireEvent.press((await screen.findAllByRole("button", { name: "Marcar entrada" }))[0]);
    await screen.findByText("Entrada de Ana Ruiz");
    fireEvent.press(screen.getAllByRole("button", { name: "Marcar entrada" }).at(-1)!);

    expect(await screen.findByText("Ya tiene una entrada registrada sin salida")).toBeTruthy();
  });

  it("el staff no entra: no consulta la lista", async () => {
    await seedSession(asRole("staff"), 10);
    serve();
    await renderScreen(<AsistenciaEquipo />);

    expect(screen.queryByText("Ana Ruiz")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Perfil", () => {
  it.each([["admin", true], ["owner", true], ["staff", false]] as const)("%s: la entrada a Asistencia del equipo %s", async (role, visible) => {
    await seedSession(asRole(role), 10);
    fetchMock.mockReturnValue(reply(200, { eligible: false, state: "none", current: null, last: null, server_time: "2026-10-20T15:00:00Z" }));
    await renderScreen(<Perfil />);

    await screen.findByRole("button", { name: "Guardar cambios" });
    expect(!!screen.queryByRole("button", { name: "Asistencia del equipo" })).toBe(visible);
  });
});

// Va al final: si otro caso corre después de este, no logra restaurar la sesión sembrada (visto en las pruebas; causa sin aclarar).
describe("Asistencia del equipo: hora capturada", () => {
  it("manda la hora capturada con el desfase de México", async () => {
    await seedSession(asRole("admin"), 10);
    serve();
    await renderScreen(<AsistenciaEquipo />);

    fireEvent.press((await screen.findAllByRole("button", { name: "Marcar entrada" }))[0]);
    fireEvent.changeText(await screen.findByLabelText("Fecha (AAAA-MM-DD)"), "2026-10-01");
    fireEvent.changeText(screen.getByLabelText("Hora (HH:mm)"), "09:00");
    fireEvent.press((await screen.findAllByRole("button", { name: "Marcar entrada" })).at(-1)!);

    await waitFor(() => expect(marks("employees/1/checkin")).toHaveLength(1));
    expect(JSON.parse(marks("employees/1/checkin")[0][1].body).at).toBe("2026-10-01T09:00:00-06:00");
    // Deja que termine la marca (cierra la hoja y vuelve a pedir la lista) antes de acabar la prueba.
    expect(await screen.findByText("Entrada de Ana Ruiz registrada")).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/attendances/roster"))).toHaveLength(2));
  });
});
