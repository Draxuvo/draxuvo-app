import { useCallback, useEffect, useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";
import type { AlertKind, SoundId } from "@/lib/sounds/catalog";
import { compact, parseChoices, type SoundChoices } from "@/lib/sounds/choices";

const KEY = "draxuvo.sound-choices";

// Estado de módulo: el aviso de comanda lista (siempre montado) y la hoja de Perfil comparten la misma elección.
let current: SoundChoices = {};
let hydrated = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const stored = parseChoices(await SecureStore.getItemAsync(KEY));
    // Una elección hecha mientras cargaba manda sobre lo guardado.
    current = { ...stored, ...current };
  } catch {
    // Sin almacenamiento seguro: la elección vive solo en memoria.
  }
  emit();
}

async function persist(value: SoundChoices): Promise<void> {
  try {
    if (Object.keys(value).length) await SecureStore.setItemAsync(KEY, JSON.stringify(value));
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ídem
  }
}

function set(next: SoundChoices): void {
  current = compact(next);
  void persist(current);
  emit();
}

/** Solo para pruebas: vuelve al estado inicial. */
export function resetSoundChoicesStore(): void {
  current = {};
  hydrated = false;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/** Elecciones de sonido por alerta, de este teléfono (spec 046). */
export function useSoundChoices() {
  const choices = useSyncExternalStore(subscribe, () => current, () => current);

  useEffect(() => {
    void hydrate();
  }, []);

  const choose = useCallback((alert: AlertKind, id: SoundId) => set({ ...current, [alert]: id }), []);
  const reset = useCallback((alert: AlertKind) => {
    const next = { ...current };
    delete next[alert];
    set(next);
  }, []);
  const resetAll = useCallback(() => set({}), []);

  return { choices, choose, reset, resetAll };
}
