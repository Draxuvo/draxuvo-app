import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { resetSoundChoicesStore, useSoundChoices } from "./use-sound-choices";

const KEY = "draxuvo.sound-choices";

describe("useSoundChoices (app)", () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync(KEY);
    resetSoundChoicesStore();
  });

  it("lee lo guardado al montar", async () => {
    await SecureStore.setItemAsync(KEY, JSON.stringify({ ready: "marimba" }));
    const { result } = await renderHook(() => useSoundChoices());
    await waitFor(() => expect(result.current.choices).toEqual({ ready: "marimba" }));
  });

  it("guarda la elección y la comparte entre componentes", async () => {
    const a = await renderHook(() => useSoundChoices());
    const b = await renderHook(() => useSoundChoices());
    await act(() => a.result.current.choose("ready", "gota"));
    expect(b.result.current.choices).toEqual({ ready: "gota" });
    await waitFor(async () => expect(await SecureStore.getItemAsync(KEY)).toBe(JSON.stringify({ ready: "gota" })));
  });

  it("restablece y borra lo guardado", async () => {
    const { result } = await renderHook(() => useSoundChoices());
    await act(() => result.current.choose("ready", "gota"));
    await act(() => result.current.reset("ready"));
    expect(result.current.choices).toEqual({});
    await waitFor(async () => expect(await SecureStore.getItemAsync(KEY)).toBeNull());
  });

  it("ignora un valor dañado", async () => {
    await SecureStore.setItemAsync(KEY, "{no");
    const { result } = await renderHook(() => useSoundChoices());
    await waitFor(() => expect(result.current.choices).toEqual({}));
  });
});
