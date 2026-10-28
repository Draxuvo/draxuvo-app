import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReadyItem, TablesResponse } from "@/api/types";
import { resetSoundChoicesStore } from "@/hooks/use-sound-choices";
import { useRestaurantAlerts } from "@/hooks/use-restaurant-alerts";
import { playReadySound } from "@/lib/sound";

jest.mock("@/lib/sound", () => ({ playReadySound: jest.fn() }));
let mockData: TablesResponse | undefined;
jest.mock("@/hooks/use-restaurant", () => ({ useTables: () => ({ data: mockData }) }));

const item = (id: number): ReadyItem => ({
  id, name: "Tacos", quantity: 1, check_id: 31, table: "4", takeout_name: null, ready_at: "2026-10-19T19:00:00Z",
});
const tables = (...ids: number[]): TablesResponse => ({ results: [], takeouts: [], ready_items: ids.map(item) });

beforeEach(async () => {
  (playReadySound as jest.Mock).mockClear();
  await SecureStore.deleteItemAsync("draxuvo.sound-choices");
  await SecureStore.deleteItemAsync("draxuvo.sound.ready");
  resetSoundChoicesStore();
  mockData = tables();
});

async function arrives() {
  const view = await renderHook(() => useRestaurantAlerts());
  await act(async () => {}); // hidrata preferencias
  mockData = tables(1);
  await view.rerender({});
  return view;
}

describe("sonido de comanda lista con sonido elegido (spec 046)", () => {
  it("sin elección suena el original de la app (clasico) al volumen guardado", async () => {
    await arrives();
    await waitFor(() => expect(playReadySound).toHaveBeenCalledTimes(1));
    expect(playReadySound).toHaveBeenCalledWith(1, "clasico");
  });

  it("suena el sonido elegido", async () => {
    await SecureStore.setItemAsync("draxuvo.sound-choices", JSON.stringify({ ready: "campana" }));
    await arrives();
    await waitFor(() => expect(playReadySound).toHaveBeenCalledWith(1, "campana"));
  });

  it("un id inexistente guardado cae a clasico", async () => {
    await SecureStore.setItemAsync("draxuvo.sound-choices", JSON.stringify({ ready: "nope" }));
    await arrives();
    await waitFor(() => expect(playReadySound).toHaveBeenCalledWith(1, "clasico"));
  });

  it("respeta el volumen guardado", async () => {
    await SecureStore.setItemAsync("draxuvo.sound.ready", JSON.stringify({ enabled: true, volume: 0.3 }));
    await arrives();
    await waitFor(() => expect(playReadySound).toHaveBeenCalledWith(0.3, "clasico"));
  });

  it("con el sonido apagado no suena", async () => {
    await SecureStore.setItemAsync("draxuvo.sound.ready", JSON.stringify({ enabled: false, volume: 1 }));
    await arrives();
    await act(async () => {});
    expect(playReadySound).not.toHaveBeenCalled();
  });

  it("no suena en la carga inicial aunque ya haya algo listo", async () => {
    mockData = tables(1);
    await renderHook(() => useRestaurantAlerts());
    await act(async () => {});
    expect(playReadySound).not.toHaveBeenCalled();
  });
});
