import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { MenuGroup } from "@/api/types";
import { OrderForm } from "@/components/order-form";
import { EMPTY_FORM } from "@/components/order-form-schema";
import { resetToasts } from "@/toast/store";
import { ToastHost } from "@/toast/toast-host";
import { clearStore, mockFetch, reply } from "@/test/helpers";

jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));

const fetchMock = mockFetch();
const menu: MenuGroup[] = [{ category: "Refacciones", items: [{ id: 7, name: "Filtro de aceite", price: 120, sku: "FIL-1", barcodes: ["7501234567890"] }] }];

function renderForm() {
  return render(
    <>
      <OrderForm mode="service" initial={EMPTY_FORM} employees={[]} menu={menu} editing={false} submitting={false} apiErrors={[]} onSubmit={jest.fn()} staff />
      <ToastHost />
    </>,
  );
}

async function typeCode(code: string) {
  await fireEvent.press(screen.getByLabelText("Escanear con cámara"));
  const input = await screen.findByLabelText("Código de barras");
  await fireEvent.changeText(input, code);
  await fireEvent(input, "submitEditing");
}

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => reply(404, { error: { status: 404, message: "no" } }));
  resetToasts();
  await clearStore();
});

describe("formulario de orden: agregar leyendo un código (spec 056)", () => {
  it("el código de barras agrega el producto del catálogo con cantidad 1", async () => {
    await renderForm();
    await typeCode("7501234567890");

    expect((await screen.findByTestId("form-qty-0")).props.value).toBe("1");
    // El nombre sale en el chip del menú y en el renglón agregado.
    expect(screen.getAllByText("Filtro de aceite", { includeHiddenElements: true })).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leer el mismo producto otra vez sube su cantidad en vez de duplicar el renglón", async () => {
    await renderForm();
    await typeCode("7501234567890");
    await screen.findByTestId("form-qty-0");
    await typeCode("fil-1");

    await waitFor(() => expect(screen.getByTestId("form-qty-0").props.value).toBe("2"));
    expect(screen.queryByTestId("form-qty-1")).toBeNull();
  });

  it("un código que no existe avisa con el número y no agrega renglones", async () => {
    await renderForm();
    await typeCode("000");

    expect((await screen.findAllByText("Código no encontrado: 000")).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("form-qty-0")).toBeNull();
  });
});
