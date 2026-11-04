import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { ScanSheet } from "@/components/scan/scan-sheet";
import { resetToasts } from "@/toast/store";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const camera = require("expo-camera") as {
  __setCameraPermission: (value: { granted: boolean; canAskAgain: boolean } | null) => void;
  __requestPermission: jest.Mock;
};

const lastProps = () => screen.getByTestId("camera-view").props as { onBarcodeScanned: (e: { data: string; bounds?: unknown }) => void; barcodeScannerSettings: { barcodeTypes: string[] } };

beforeEach(() => {
  jest.useFakeTimers();
  resetToasts();
  camera.__requestPermission.mockClear();
  camera.__setCameraPermission({ granted: true, canAskAgain: true });
});
afterEach(() => jest.useRealTimers());

describe("ScanSheet (spec 056)", () => {
  it("lee un código sostenido varios cuadros una sola vez y pide solo los formatos de Draxuvo", async () => {
    const onScan = jest.fn();
    await render(<ScanSheet visible onClose={() => {}} onScan={onScan} />);
    expect(lastProps().barcodeScannerSettings.barcodeTypes).toEqual(["ean13", "upc_a", "ean8", "code128"]);

    for (let i = 0; i < 10; i += 1) {
      await act(async () => {
        lastProps().onBarcodeScanned({ data: " 7501234567890 " });
        jest.advanceTimersByTime(150);
      });
    }
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("7501234567890");
    expect(screen.getByText("Leído: 7501234567890")).toBeTruthy();
  });

  it("con varios códigos a la vez elige el más cercano al centro", async () => {
    const onScan = jest.fn();
    await render(<ScanSheet visible onClose={() => {}} onScan={onScan} />);
    await act(async () => {
      lastProps().onBarcodeScanned({ data: "LEJOS", bounds: { origin: { x: 0, y: 0 }, size: { width: 4, height: 4 } } });
      lastProps().onBarcodeScanned({ data: "CENTRO", bounds: { origin: { x: -1, y: -1 }, size: { width: 4, height: 4 } } });
      jest.advanceTimersByTime(150);
    });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith("CENTRO");
  });

  it("un código no válido avisa y no llama a onScan", async () => {
    const onScan = jest.fn();
    await render(<ScanSheet visible onClose={() => {}} onScan={onScan} />);
    await act(async () => {
      lastProps().onBarcodeScanned({ data: "ñandú" });
      jest.advanceTimersByTime(150);
    });
    expect(onScan).not.toHaveBeenCalled();
    expect(screen.getByText("Código no válido, intenta de nuevo.")).toBeTruthy();
  });

  it("el campo manual manda el mismo texto limpio y se vacía; vacío no hace nada", async () => {
    const onScan = jest.fn();
    await render(<ScanSheet visible onClose={() => {}} onScan={onScan} />);
    const input = screen.getByLabelText("Código de barras");
    await fireEvent.changeText(input, "   ");
    await fireEvent(input, "submitEditing");
    expect(onScan).not.toHaveBeenCalled();

    await fireEvent.changeText(input, "  ABC-1 ");
    await fireEvent(input, "submitEditing");
    expect(onScan).toHaveBeenCalledWith("ABC-1");
    expect(screen.getByLabelText("Código de barras").props.value).toBe("");
  });

  it("sin permiso lo pide al abrir y ofrece permitirlo", async () => {
    camera.__setCameraPermission({ granted: false, canAskAgain: true });
    await render(<ScanSheet visible onClose={() => {}} onScan={jest.fn()} />);
    expect(camera.__requestPermission).toHaveBeenCalled();
    expect(screen.queryByTestId("camera-view")).toBeNull();
    expect(screen.getByText("Permitir cámara")).toBeTruthy();
  });

  it("si ya no se puede pedir el permiso, manda a Ajustes y deja el campo manual", async () => {
    camera.__setCameraPermission({ granted: false, canAskAgain: false });
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await render(<ScanSheet visible onClose={() => {}} onScan={jest.fn()} />);
    expect(screen.getByText(/permiso de la cámara está desactivado/)).toBeTruthy();
    expect(screen.getByLabelText("Código de barras")).toBeTruthy();
    await fireEvent.press(screen.getByText("Abrir Ajustes"));
    expect(open).toHaveBeenCalled();
    open.mockRestore();
  });

  it("sin continuous se cierra tras la primera lectura", async () => {
    const onClose = jest.fn();
    await render(<ScanSheet visible onClose={onClose} onScan={jest.fn()} continuous={false} />);
    await act(async () => {
      lastProps().onBarcodeScanned({ data: "123" });
      jest.advanceTimersByTime(150);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
