import { fireEvent, render } from "@testing-library/react-native";
import { RestaurantAlertBanner } from "@/components/restaurant-alert-banner";
import type { RestaurantAlert } from "@/hooks/use-restaurant-alerts";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));

const ready = (id: number, name = "Tacos al pastor", table: string | null = "4", takeout: string | null = null): RestaurantAlert => ({
  kind: "ready",
  key: `ready:${id}`,
  item: { id, name, quantity: 1, check_id: 31, table, takeout_name: takeout, ready_at: "2026-10-19T19:00:00Z" },
});
const toPay = (id: number, name = "Mesa 4"): RestaurantAlert => ({ kind: "to_pay", key: `to_pay:${id}`, checkId: id, name });
const taken = (id: number, name = "Mesa 7"): RestaurantAlert => ({ kind: "table_taken", key: `table:${id}`, checkId: 90 + id, name });

/** Pinta la banda con esos avisos y devuelve sus consultas y los espías de abrir y descartar. */
async function show(alerts: RestaurantAlert[]) {
  const open = jest.fn();
  const dismiss = jest.fn();
  const view = await render(<RestaurantAlertBanner alerts={alerts} onOpen={open} onDismiss={dismiss} />);
  return { view, open, dismiss };
}

describe("banda de avisos del restaurante", () => {
  it("muestra el aviso de listo con la mesa y el platillo", async () => {
    const { view } = await show([ready(1)]);

    expect(view.getByText("Mesa 4: Tacos al pastor listo")).toBeTruthy();
  });

  it("una cuenta para llevar avisa con el nombre del cliente", async () => {
    const { view } = await show([ready(2, "Cola", null, "Luis")]);

    expect(view.getByText("Luis: Cola listo")).toBeTruthy();
  });

  it("muestra el aviso de cuenta por cobrar", async () => {
    const { view } = await show([toPay(31)]);

    expect(view.getByText("Mesa 4 por cobrar")).toBeTruthy();
  });

  it("muestra el aviso de mesa tomada por otra persona", async () => {
    const { view } = await show([taken(7)]);

    expect(view.getByText("Mesa 7: la tomó otra persona")).toBeTruthy();
  });

  it("con más de tres avisos resume el resto en un contador", async () => {
    const { view } = await show([ready(1, "Uno"), ready(2, "Dos"), ready(3, "Tres"), ready(4, "Cuatro")]);

    expect(view.getByText("Mesa 4: Tres listo")).toBeTruthy();
    expect(view.queryByText("Mesa 4: Cuatro listo")).toBeNull();
    expect(view.getByText("+1")).toBeTruthy();
  });

  it("tocar el aviso lo abre y la X lo descarta", async () => {
    const { view, open, dismiss } = await show([ready(1)]);

    fireEvent.press(view.getByLabelText("Mesa 4: Tacos al pastor listo. Ver cuenta"));
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ kind: "ready" }));

    fireEvent.press(view.getByLabelText("Cerrar"));
    expect(dismiss).toHaveBeenCalledWith("ready:1");
  });

  it("sin avisos no dibuja nada", async () => {
    const { view } = await show([]);

    expect(view.queryByLabelText("Cerrar")).toBeNull();
  });
});
