// El modal "Marcar entrada" se ofrece una vez por sesión (spec 026): se recuerda por usuario y empresa y se
// olvida al cerrar sesión.
const prompted = new Set<string>();

export const promptKey = (userId: number | undefined, companyId: number | null) => `${userId}:${companyId}`;
export const wasPrompted = (key: string) => prompted.has(key);
export const markPrompted = (key: string) => void prompted.add(key);
export const clearPrompted = () => prompted.clear();

// Mientras «Marcar entrada» está a la vista o por aparecer (aún se consulta la asistencia), otras hojas de inicio de
// sesión, como la del permiso de avisos (spec 057), esperan para no salir encimadas.
let entryBlocking = false;
const blockingListeners = new Set<() => void>();
export const isEntryBlocking = () => entryBlocking;
export const setEntryBlocking = (value: boolean) => {
  if (entryBlocking === value) return;
  entryBlocking = value;
  blockingListeners.forEach((listener) => listener());
};
export const subscribeEntryBlocking = (listener: () => void) => {
  blockingListeners.add(listener);
  return () => void blockingListeners.delete(listener);
};
