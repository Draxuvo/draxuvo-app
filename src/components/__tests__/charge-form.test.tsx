import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ChargeForm } from "../charge-form";

const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }));

describe("formulario de cobro", () => {
  it("efectivo menor al total no se envía y avisa", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ChargeForm total={100} blocked={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId("charge-received"), "60");
    expect(screen.getByTestId("charge-diff").props.children).toContain("Faltan");
    await press("Cobrar $100.00");

    expect(await screen.findByText("El efectivo recibido es menor al total.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("muestra el cambio y envía el monto recibido", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ChargeForm total={80} blocked={false} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId("charge-received"), "100");
    expect(screen.getByTestId("charge-diff").props.children).toContain("$20.00");
    await press("Cobrar $80.00");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ payments: [{ method: "cash", amount_received: 100 }] }));
  });

  it("con tarjeta no pide monto", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ChargeForm total={80} blocked={false} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.queryByTestId("charge-received")).toBeNull();
    await press("Cobrar $80.00");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ payments: [{ method: "card", amount: 80 }] }));
  });

  it("un doble toque cobra una sola vez", async () => {
    let finish: () => void = () => {};
    const onSubmit = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    await render(<ChargeForm total={80} blocked={false} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    const button = screen.getByRole("button", { name: "Cobrar $80.00" });
    await fireEvent.press(button);
    await fireEvent.press(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    finish();
  });

  it("sin conceptos con precio el botón queda desactivado", async () => {
    await render(<ChargeForm total={0} blocked onSubmit={jest.fn()} />);

    expect(screen.getByText("Esta orden no tiene conceptos con precio, no se puede cobrar.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cobrar $0.00" }).props.accessibilityState.disabled).toBe(true);
  });

  // --- spec 015: varios pagos y terminal ---

  const terminal = { id: 3, name: "BBVA caja 1", provider: "bbva" as const, provider_label: "BBVA", active: true };

  it("tarjeta 300 en la única terminal + efectivo 250 sobre 500 da 50 de cambio", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ChargeForm total={500} blocked={false} terminals={[terminal]} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.getByRole("button", { name: "BBVA caja 1" }).props.accessibilityState.selected).toBe(true);
    await fireEvent.changeText(screen.getByTestId("charge-auth-0"), "123456");
    await press("Agregar otro pago");
    await fireEvent.changeText(screen.getByTestId("charge-amount-0"), "300");
    await fireEvent.changeText(screen.getByTestId("charge-received"), "250");
    expect(screen.getByTestId("charge-diff").props.children).toContain("$50.00");
    await press("Cobrar $500.00");

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        payments: [
          { method: "card", amount: 300, terminal_id: 3, authorization_code: "123456" },
          { method: "cash", amount_received: 250 },
        ],
      }),
    );
  });

  it("con varias terminales pide elegir una antes de cobrar", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const other = { ...terminal, id: 4, name: "Point barra" };
    await render(<ChargeForm total={80} blocked={false} terminals={[terminal, other]} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    await press("Cobrar $80.00");
    expect(await screen.findByText("Elige la terminal en que se cobró.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    await press("Point barra");
    await press("Cobrar $80.00");
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ payments: [{ method: "card", amount: 80, terminal_id: 4 }] }));
  });

  it("la transferencia pide referencia", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ChargeForm total={80} blocked={false} onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByRole("radio", { name: "Transferencia" }));
    await press("Cobrar $80.00");
    expect(await screen.findByText("Escribe la referencia de la transferencia.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
