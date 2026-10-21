// Almacén de avisos (toasts) del app (spec 022). Vive fuera de React para poder llamarse desde hooks y funciones de
// acción: `toast.success("Mesa liberada")`. A lo sumo uno visible; uno nuevo reemplaza al anterior y uno idéntico
// seguido solo reinicia el tiempo. El `ToastHost` del layout raíz lo dibuja.

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  tone: ToastTone;
  text: string;
}

/** Cuánto se queda cada tono en pantalla; los errores más, porque hay que leerlos. */
export const TOAST_MS: Record<ToastTone, number> = { success: 3000, info: 4000, error: 5000 };

let current: ToastItem | null = null;
let counter = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

function schedule(tone: ToastTone) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    current = null;
    timer = undefined;
    emit();
  }, TOAST_MS[tone]);
}

function show(tone: ToastTone, text: string) {
  const message = text.trim();
  if (!message) return;
  // El mismo aviso otra vez seguido no se duplica: se queda el que está y se reinicia su tiempo.
  if (current && current.tone === tone && current.text === message) return schedule(tone);
  current = { id: ++counter, tone, text: message };
  schedule(tone);
  emit();
}

export const toast = {
  success: (text: string) => show("success", text),
  error: (text: string) => show("error", text),
  info: (text: string) => show("info", text),
  dismiss: () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (current) {
      current = null;
      emit();
    }
  },
};

export const subscribeToasts = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export const getToast = () => current;

/** Solo para pruebas: deja el almacén vacío. */
export function resetToasts() {
  if (timer) clearTimeout(timer);
  timer = undefined;
  current = null;
  emit();
}
