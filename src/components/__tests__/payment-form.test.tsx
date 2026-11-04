import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { PaymentForm } from "../payment-form";

const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }));
const choose = (method: string) => fireEvent.press(screen.getByRole("radio", { name: method }));

// Spec 054 (H-51): la referencia solo es obligatoria en la transferencia; con tarjeta es opcional y se manda si se captura.
describe("formulario de pago de una cuenta de mesa", () => {
  it("con tarjeta se registra sin referencia", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<PaymentForm balance={90} onSubmit={onSubmit} />);

    await choose("Tarjeta");
    await press("Registrar pago");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ method: "card", amount: "90.00" }));
  });

  it("con tarjeta manda la referencia si se captura", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<PaymentForm balance={90} onSubmit={onSubmit} />);

    await choose("Tarjeta");
    await fireEvent.changeText(screen.getByLabelText("Referencia (opcional)"), " aut-1 ");
    await press("Registrar pago");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ method: "card", amount: "90.00", reference: "aut-1" }));
  });

  it("con transferencia sin referencia avisa y no se envía", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<PaymentForm balance={90} onSubmit={onSubmit} />);

    await choose("Transferencia");
    await press("Registrar pago");

    expect(await screen.findByText("Escribe la referencia")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("con transferencia y referencia se registra", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<PaymentForm balance={90} onSubmit={onSubmit} />);

    await choose("Transferencia");
    await fireEvent.changeText(screen.getByLabelText("Referencia"), "t9");
    await press("Registrar pago");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ method: "transfer", amount: "90.00", reference: "t9" }));
  });
});
