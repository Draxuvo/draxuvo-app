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

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ payment_method: "cash", amount_received: 100 }));
  });

  it("con tarjeta no pide monto", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ChargeForm total={80} blocked={false} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("radio", { name: "Tarjeta" }));
    expect(screen.queryByTestId("charge-received")).toBeNull();
    await press("Cobrar $80.00");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ payment_method: "card" }));
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
});
