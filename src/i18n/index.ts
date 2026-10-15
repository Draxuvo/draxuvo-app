import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import en from "./en.json";
import es from "./es.json";

export type Locale = "es" | "en";
type Messages = typeof es;

const CATALOGS: Record<Locale, Messages> = { es, en };
const STORAGE_KEY = "draxuvo.locale";

let current: Locale = detect();
const listeners = new Set<() => void>();

function detect(): Locale {
  const code = Localization.getLocales()[0]?.languageCode;
  return code === "en" ? "en" : "es";
}

function lookup(catalog: Messages, key: string): string | undefined {
  let node: unknown = catalog;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Texto traducido; `{name}` se reemplaza con `params`. Una clave que falta se devuelve tal cual. */
export function t(key: string, params?: Record<string, string | number>): string {
  const text = lookup(CATALOGS[current], key) ?? lookup(CATALOGS.es, key) ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function getLocale(): Locale {
  return current;
}

export async function setLocale(locale: Locale): Promise<void> {
  current = locale;
  listeners.forEach((listener) => listener());
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, locale);
  } catch {
    // Sin guardado, el idioma vuelve al del teléfono en la siguiente apertura.
  }
}

/** Idioma elegido antes en este dispositivo, si lo hay; si no, se queda el del teléfono. */
export async function loadLocale(): Promise<Locale> {
  try {
    const saved = await SecureStore.getItemAsync(STORAGE_KEY);
    if (saved === "es" || saved === "en") {
      current = saved;
      listeners.forEach((listener) => listener());
    }
  } catch {
    // Se queda el idioma detectado.
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Vuelve a pintar el componente cuando cambia el idioma. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}
