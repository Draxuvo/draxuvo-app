import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { resetToasts, toast, TOAST_MS } from "@/toast/store";
import { ToastHost } from "@/toast/toast-host";

beforeEach(() => {
  jest.useFakeTimers();
  resetToasts();
  jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => {});
});

afterEach(() => {
  resetToasts();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("toast (almacén)", () => {
  it("un aviso nuevo reemplaza al visible", async () => {
    await render(<ToastHost />);
    await act(async () => { toast.success("Mesa liberada"); });
    await act(async () => { toast.error("No se pudo guardar"); });

    expect(screen.queryByText("Mesa liberada")).toBeNull();
    expect(screen.getByText("No se pudo guardar")).toBeTruthy();
  });

  it("el mismo aviso seguido no se duplica y reinicia su tiempo", async () => {
    await render(<ToastHost />);
    await act(async () => { toast.info("Hola"); });
    await act(async () => { jest.advanceTimersByTime(TOAST_MS.info - 500); });
    await act(async () => { toast.info("Hola"); });
    await act(async () => { jest.advanceTimersByTime(TOAST_MS.info - 500); });

    expect(screen.getAllByText("Hola")).toHaveLength(1);
    await act(async () => { jest.advanceTimersByTime(600); });
    expect(screen.queryByText("Hola")).toBeNull();
  });

  it("cada tono dura lo suyo: éxito 3 s, información 4 s, error 5 s", async () => {
    await render(<ToastHost />);
    for (const [tone, ms] of [["success", 3000], ["info", 4000], ["error", 5000]] as const) {
      await act(async () => { toast[tone](`aviso ${tone}`); });
      await act(async () => { jest.advanceTimersByTime(ms - 1); });
      expect(screen.getByText(`aviso ${tone}`)).toBeTruthy();
      await act(async () => { jest.advanceTimersByTime(2); });
      expect(screen.queryByText(`aviso ${tone}`)).toBeNull();
    }
  });

  it("ignora un texto vacío", async () => {
    await render(<ToastHost />);
    await act(async () => { toast.success("   "); });
    expect(screen.queryByTestId("toast-success")).toBeNull();
  });
});

describe("ToastHost", () => {
  it("muestra el texto con su tono y lo anuncia a los lectores de pantalla", async () => {
    await render(<ToastHost />);
    await act(async () => { toast.error("No se pudo guardar. Revisa tu conexión."); });

    expect(screen.getByTestId("toast-error")).toBeTruthy();
    expect(screen.getByRole("alert", { name: "No se pudo guardar. Revisa tu conexión." })).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("No se pudo guardar. Revisa tu conexión.");
  });

  it("se cierra al tocarlo", async () => {
    await render(<ToastHost />);
    await act(async () => { toast.success("Mesa liberada"); });

    await fireEvent.press(screen.getByTestId("toast-success"));

    expect(screen.queryByText("Mesa liberada")).toBeNull();
  });

  it("se oculta solo y no deja nada en pantalla", async () => {
    await render(<ToastHost />);
    await act(async () => { toast.success("Mesa liberada"); });
    expect(screen.getByText("Mesa liberada")).toBeTruthy();

    await act(async () => { jest.advanceTimersByTime(TOAST_MS.success + 10); });

    expect(screen.queryByText("Mesa liberada")).toBeNull();
  });
});
