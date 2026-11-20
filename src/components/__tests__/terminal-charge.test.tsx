import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { abandonTerminalCharge, createTerminalCharge, getTerminalCharge } from "@/api/terminal-charges";
import type { PaymentTerminal, TerminalCharge } from "@/api/types";
import { ChargeForm } from "../charge-form";
import { PaymentForm } from "../payment-form";
import { TerminalWait } from "../terminal-charge/terminal-wait";

jest.mock("@/api/terminal-charges", () => ({
  createTerminalCharge: jest.fn(),
  getTerminalCharge: jest.fn(),
  cancelTerminalCharge: jest.fn(),
  abandonTerminalCharge: jest.fn(),
}));


const caja: PaymentTerminal = { id: 7, name: "Caja 1", provider: "mercado_pago", provider_label: "Mercado Pago", active: true, chargeable: true, kind: "integrated" };

const charge = (over: Partial<TerminalCharge> = {}): TerminalCharge => ({
  id: 41, status: "pending", status_detail: "at_terminal", amount: "80.00", terminal: { id: 7, name: "Caja 1", provider: "mercado_pago" },
  owner: { type: "work_order", id: 5, label: "x" }, created_by: null, created_at: "", expires_at: "", resolved_at: null,
  provider_reference: null, card_last4: null, unapplied_reason: null, result: null, refund: null, allowed_actions: ["cancel", "abandon"],
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("cobro con terminal integrada (spec 069)", () => {
  it("la orden manda el monto a la terminal y avisa al aplicarse", async () => {
    jest.mocked(createTerminalCharge).mockResolvedValue(charge());
    jest.mocked(getTerminalCharge).mockResolvedValue(charge({ status: "applied", result: { work_order_id: 5 } }));
    const onSubmit = jest.fn();
    const onTerminalApplied = jest.fn();
    await render(<ChargeForm total={80} blocked={false} terminals={[caja]} onSubmit={onSubmit} orderId={5} onTerminalApplied={onTerminalApplied} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.getByText("Caja 1 · Integrada")).toBeTruthy();
    expect(screen.queryByTestId("charge-auth-0")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Cobrar $80.00" }));

    expect(createTerminalCharge).toHaveBeenCalledWith({ terminal_id: 7, amount: 80, owner: { type: "work_order", id: 5 }, params: { payments: [] } });
    await waitFor(() => expect(onTerminalApplied).toHaveBeenCalled());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("el abono de una cuenta va a la terminal", async () => {
    jest.mocked(createTerminalCharge).mockResolvedValue(charge({ owner: { type: "check", id: 10, label: "4" } }));
    jest.mocked(getTerminalCharge).mockResolvedValue(charge({ status: "pending" }));
    const onSubmit = jest.fn();
    await render(<PaymentForm balance={100} terminals={[caja]} onSubmit={onSubmit} checkId={10} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    await fireEvent.press(screen.getByRole("button", { name: "Registrar pago" }));

    expect(createTerminalCharge).toHaveBeenCalledWith({ terminal_id: 7, amount: 100, owner: { type: "check", id: 10 }, params: {} });
    expect(await screen.findByText("Esperando terminal…")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("registrar a mano suelta la solicitud y vuelve al formulario", async () => {
    jest.mocked(createTerminalCharge).mockResolvedValue(charge());
    jest.mocked(getTerminalCharge).mockResolvedValue(charge({ status: "declined", status_detail: "rejected_by_issuer" }));
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ChargeForm total={80} blocked={false} terminals={[caja]} onSubmit={onSubmit} orderId={5} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    await fireEvent.press(screen.getByRole("button", { name: "Cobrar $80.00" }));
    expect(await screen.findByText("El banco rechazó la tarjeta")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Registrar a mano" }));
    expect(await screen.findByText("Se registrará como pago a mano en Caja 1.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Cobrar $80.00" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ payments: [{ method: "card", amount: 80, terminal_id: 7 }] }));
    expect(abandonTerminalCharge).not.toHaveBeenCalled();
  });

  it("la espera deja cancelar y pide confirmar antes de registrar a mano", async () => {
    const onCancel = jest.fn();
    const onManual = jest.fn();
    await render(
      <TerminalWait amount={80} terminalName="Caja 1" charge={charge()} starting={false} error={null} canceling={false}
        onCancel={onCancel} onRetry={jest.fn()} onChooseOther={jest.fn()} onManual={onManual} />,
    );
    expect(screen.getByText("Esperando el pago en la terminal")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Registrar a mano" }));
    expect(screen.getByText(/revisa en la terminal/)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Sí, registrar a mano" }));
    expect(onManual).toHaveBeenCalled();
  });
});
