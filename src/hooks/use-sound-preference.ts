import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

export interface SoundPreference {
  enabled: boolean;
  volume: number;
}

const KEY = "draxuvo.sound.";
// En la app el audio no requiere un gesto previo, así que el sonido de "listo" nace activado.
const DEFAULT: SoundPreference = { enabled: true, volume: 1 };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

async function read(surface: string): Promise<SoundPreference> {
  try {
    const raw = await SecureStore.getItemAsync(KEY + surface);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<SoundPreference>;
    return {
      enabled: parsed.enabled === true,
      volume: typeof parsed.volume === "number" ? clamp(parsed.volume) : 1,
    };
  } catch {
    return DEFAULT;
  }
}

async function write(surface: string, pref: SoundPreference): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY + surface, JSON.stringify(pref));
  } catch {
    // Sin almacenamiento seguro: la preferencia vive solo en memoria.
  }
}

export function useSoundPreference(surfaceKey: string) {
  const [pref, setPref] = useState<SoundPreference>(DEFAULT);

  useEffect(() => {
    let active = true;
    void read(surfaceKey).then((value) => {
      if (active) setPref(value);
    });
    return () => {
      active = false;
    };
  }, [surfaceKey]);

  const setEnabled = useCallback((enabled: boolean) => {
    setPref((prev) => {
      const next = { ...prev, enabled };
      void write(surfaceKey, next);
      return next;
    });
  }, [surfaceKey]);

  const setVolume = useCallback((volume: number) => {
    setPref((prev) => {
      const next = { ...prev, volume: clamp(volume) };
      void write(surfaceKey, next);
      return next;
    });
  }, [surfaceKey]);

  return { enabled: pref.enabled, volume: pref.volume, setEnabled, setVolume };
}
