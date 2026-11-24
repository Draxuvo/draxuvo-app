import * as SecureStore from "expo-secure-store";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import type { PaymentTerminal } from "@/api/types";
import { ChargeForm } from "@/components/charge-form";
import { PaymentForm } from "@/components/payment-form";
import { defaultTerminalFor, readRememberedTerminal, rememberTerminal } from "@/lib/remembered-terminal";
import { clearStore, mockFetch, reply, seedSession, staffUser } from "@/test/helpers";
import { renderScreen } from "@/test/render";

// Spec 069, US4 (T074): el teléfono recuerda la última terminal con la que se cobró con tarjeta, por empresa.
const caja1: PaymentTerminal = { id: 3, name: "Caja 1", provider: "bbva", provider_label: "BBVA", active: true };
const caja2: PaymentTerminal = { id: 4, name: "Caja 2", provider: "bbva", provider_label: "BBVA", active: true };

const fetchMock = mockFetch();

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => reply(404, { error: { status: 404, message: "x" } }));
  await clearStore();
  await SecureStore.deleteItemAsync("draxuvo.terminal.10");
  await SecureStore.deleteItemAsync("draxuvo.terminal.20");
  await seedSession(staffUser, 10);
});

describe("terminal recordada (lógica)", () => {
  it("propone la única terminal, o la recordada solo si sigue en la lista y activa", () => {
    expect(defaultTerminalFor([caja1], null)).toBe(3);
    expect(defaultTerminalFor([caja1, caja2], 4)).toBe(4);
    expect(defaultTerminalFor([caja1, caja2], null)).toBeNull();
    expect(defaultTerminalFor([caja1, caja2], 99)).toBeNull();
    expect(defaultTerminalFor([caja1, { ...caja2, active: false }], 4)).toBeNull();
  });

  it("guarda por empresa y descarta lo ilegible", async () => {
    await rememberTerminal(10, 4);
    expect(await readRememberedTerminal(10)).toBe(4);
    expect(await readRememberedTerminal(20)).toBeNull();
    expect(await readRememberedTerminal(null)).toBeNull();
    await SecureStore.setItemAsync("draxuvo.terminal.20", "basura");
    expect(await readRememberedTerminal(20)).toBeNull();
  });
});

describe("terminal recordada en el cobro", () => {
  it("el cobro de una orden propone la última terminal de este teléfono y recuerda la que se elige", async () => {
    await rememberTerminal(10, 4);
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await renderScreen(<ChargeForm total={80} blocked={false} terminals={[caja1, caja2]} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Caja 2" }).props.accessibilityState.selected).toBe(true));

    await fireEvent.press(screen.getByRole("button", { name: "Caja 1" }));
    await fireEvent.press(screen.getByRole("button", { name: "Cobrar $80.00" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ payments: [{ method: "card", amount: 80, terminal_id: 3 }] }));
    await waitFor(async () => expect(await readRememberedTerminal(10)).toBe(3));
  });

  it("si la terminal recordada ya no está, no propone ninguna y pide elegir", async () => {
    await rememberTerminal(10, 99);
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await renderScreen(<ChargeForm total={80} blocked={false} terminals={[caja1, caja2]} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.getByRole("button", { name: "Caja 1" }).props.accessibilityState.selected).toBe(false);
    expect(screen.getByRole("button", { name: "Caja 2" }).props.accessibilityState.selected).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: "Cobrar $80.00" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await readRememberedTerminal(10)).toBe(99);
  });

  it("el abono de una cuenta también la propone y la recuerda", async () => {
    await rememberTerminal(10, 3);
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await renderScreen(<PaymentForm balance={120} terminals={[caja1, caja2]} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Caja 1" }).props.accessibilityState.selected).toBe(true));
    await fireEvent.press(screen.getByRole("button", { name: "Caja 2" }));
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ method: "card", terminal_id: 4 })));
    await waitFor(async () => expect(await readRememberedTerminal(10)).toBe(4));
  });
});
