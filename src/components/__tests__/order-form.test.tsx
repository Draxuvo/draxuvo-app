import { fireEvent, render, screen } from "@testing-library/react-native";
import { OrderForm } from "../order-form";
import { EMPTY_FORM, toPayload, validateOrderForm, type OrderFormValues } from "../order-form-schema";

const base = (extra: Partial<OrderFormValues> = {}): OrderFormValues => ({ ...EMPTY_FORM, title: "Cambiar balatas", ...extra });

describe("validación del formulario", () => {
  it("el título es obligatorio (mesa en modo pedido)", () => {
    expect(validateOrderForm(base({ title: " " }), "service").title).toBe("titleRequired");
    expect(validateOrderForm(base({ title: "" }), "order").title).toBe("tableRequired");
  });

  it("revisa teléfono y fecha solo en servicio", () => {
    const bad = base({ customerPhone: "abc", dueDate: "mañana" });
    expect(validateOrderForm(bad, "service")).toMatchObject({ customerPhone: "phoneInvalid", dueDate: "dueInvalid" });
    expect(validateOrderForm(bad, "order")).toMatchObject({ items: {} });
    expect(validateOrderForm(bad, "order").customerPhone).toBeUndefined();
  });

  it("revisa cantidades y precios de cada concepto", () => {
    const items = [
      { description: "ok", quantity: "2", unitPrice: "10.50" },
      { description: "", quantity: "0", unitPrice: "x" },
    ];
    expect(validateOrderForm(base({ items }), "service").items).toEqual({
      1: { description: "descriptionRequired", quantity: "quantityInvalid", unitPrice: "priceInvalid" },
    });
  });
});

describe("armado de la petición", () => {
  const values = base({
    employeeId: 3,
    customerPhone: "5512345678",
    items: [{ productId: 7, description: "Taco", quantity: "2", unitPrice: "35" }],
    steps: [{ description: "Quitar rueda" }, { description: "  " }],
  });

  it("servicio incluye cliente, prioridad y pasos (sin los vacíos)", () => {
    const payload = toPayload(values, "service");
    expect(payload.work_order).toMatchObject({ title: "Cambiar balatas", employee_id: 3, customer_phone: "5512345678", priority: "medium" });
    expect(payload.steps).toEqual([{ description: "Quitar rueda", position: 0 }]);
    expect(payload.items).toEqual([{ product_id: 7, description: "Taco", quantity: 2, unit_price: 35, position: 0 }]);
  });

  it("pedido solo lleva mesa, responsable y productos, sin pasos", () => {
    const payload = toPayload(values, "order");
    expect(payload.work_order).toEqual({ title: "Cambiar balatas", employee_id: 3 });
    expect(payload.steps).toBeUndefined();
  });
});

describe("formulario", () => {
  const employees = [{ id: 3, name: "Sara" }];
  const menu = [{ category: "Tacos", items: [{ id: 7, name: "Pastor", price: 35 }] }];

  it("no envía con datos inválidos y marca el campo", async () => {
    const onSubmit = jest.fn();
    await render(<OrderForm mode="service" initial={EMPTY_FORM} employees={employees} menu={[]} editing={false} submitting={false} apiErrors={[]} onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByRole("button", { name: "Crear orden" }));

    expect(await screen.findByText("Escribe el título de la orden.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("servicio: envía título, responsable y teléfono", async () => {
    const onSubmit = jest.fn();
    await render(<OrderForm mode="service" initial={EMPTY_FORM} employees={employees} menu={[]} editing={false} submitting={false} apiErrors={[]} onSubmit={onSubmit} />);

    await fireEvent.changeText(screen.getByTestId("form-title"), "Revisión");
    await fireEvent.press(screen.getByRole("button", { name: "Sara" }));
    await fireEvent.changeText(screen.getByTestId("form-phone"), "55 1234 5678");
    await fireEvent.press(screen.getByRole("button", { name: "Crear orden" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "Revisión", employeeId: 3, customerPhone: "55 1234 5678" }));
  });

  it("pedido: agrega productos del menú y suma al repetir; no hay pasos ni cliente", async () => {
    const onSubmit = jest.fn();
    await render(<OrderForm mode="order" initial={EMPTY_FORM} employees={[]} menu={menu} editing={false} submitting={false} apiErrors={[]} onSubmit={onSubmit} />);

    expect(screen.queryByTestId("form-phone")).toBeNull();
    expect(screen.queryByRole("button", { name: "Agregar paso" })).toBeNull();
    await fireEvent.changeText(screen.getByTestId("form-title"), "Mesa 4");
    await fireEvent.press(screen.getByRole("button", { name: "Pastor" }));
    await fireEvent.press(screen.getByRole("button", { name: "Pastor" }));
    await fireEvent.press(screen.getByRole("button", { name: "Crear orden" }));

    expect(onSubmit.mock.calls[0][0].items).toEqual([expect.objectContaining({ productId: 7, quantity: "2", unitPrice: "35" })]);
  });

  it("muestra los errores que devuelve la API", async () => {
    await render(<OrderForm mode="service" initial={base()} employees={[]} menu={[]} editing={false} submitting={false} apiErrors={["El responsable no existe"]} onSubmit={jest.fn()} />);

    expect(screen.getByText("El responsable no existe")).toBeTruthy();
  });
});
