import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import { SoundPicker } from "@/components/sound-picker";
import { resetSoundChoicesStore } from "@/hooks/use-sound-choices";
import { setLocale, t } from "@/i18n";
import { playSound } from "@/lib/sound";
import { SOUND_IDS } from "@/lib/sounds/catalog";
import { renderScreen } from "@/test/render";

jest.mock("@/lib/sound", () => ({ playSound: jest.fn(() => true), playReadySound: jest.fn() }));

const stored = async () => JSON.parse((await SecureStore.getItemAsync("draxuvo.sound-choices")) ?? "{}");

beforeEach(async () => {
  (playSound as jest.Mock).mockReset().mockReturnValue(true);
  await SecureStore.deleteItemAsync("draxuvo.sound-choices");
  await SecureStore.deleteItemAsync("draxuvo.sound.ready");
  resetSoundChoicesStore();
  await setLocale("es");
});

describe("hoja de sonido de comanda lista", () => {
  it("ofrece al menos 8 sonidos con nombre en español e inglés", async () => {
    expect(SOUND_IDS.length).toBeGreaterThanOrEqual(8);
    for (const locale of ["es", "en"] as const) {
      await setLocale(locale);
      for (const id of SOUND_IDS) expect(t(`sounds.${id}`)).not.toBe(`sounds.${id}`);
    }
  });

  it("marca clasico por omisión y guarda la elección", async () => {
    await renderScreen(<SoundPicker visible onClose={jest.fn()} />);

    expect(screen.getByRole("radio", { name: "Clásico" }).props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByRole("radio", { name: "Campana" }));

    await waitFor(async () => expect(await stored()).toEqual({ ready: "campana" }));
    expect(screen.getByRole("radio", { name: "Campana" }).props.accessibilityState.selected).toBe(true);
  });

  it("probar suena al volumen guardado aunque el sonido esté apagado", async () => {
    await SecureStore.setItemAsync("draxuvo.sound.ready", JSON.stringify({ enabled: false, volume: 0.5 }));
    await renderScreen(<SoundPicker visible onClose={jest.fn()} />);

    await waitFor(() => {
      fireEvent.press(screen.getByLabelText("Probar Marimba"));
      expect(playSound).toHaveBeenCalledWith("marimba", 0.5);
    });
  });

  it("si no se puede reproducir avisa con un toast", async () => {
    (playSound as jest.Mock).mockReturnValue(false);
    await renderScreen(<SoundPicker visible onClose={jest.fn()} />);

    fireEvent.press(screen.getByLabelText("Probar Gota"));

    expect((await screen.findAllByText("No se pudo reproducir el sonido")).length).toBeGreaterThan(0);
  });

  it("restablece a clasico", async () => {
    await SecureStore.setItemAsync("draxuvo.sound-choices", JSON.stringify({ ready: "gota" }));
    await renderScreen(<SoundPicker visible onClose={jest.fn()} />);

    fireEvent.press(await screen.findByText("Restablecer"));

    await waitFor(async () => expect(await stored()).toEqual({}));
    expect(screen.getByRole("radio", { name: "Clásico" }).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByText("Restablecer")).toBeNull();
  });

  it("Listo cierra la hoja", async () => {
    const onClose = jest.fn();
    await renderScreen(<SoundPicker visible onClose={onClose} />);

    fireEvent.press(screen.getByText("Hecho"));

    expect(onClose).toHaveBeenCalled();
  });
});
