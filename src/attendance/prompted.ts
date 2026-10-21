// El modal "Marcar entrada" se ofrece una vez por sesión (spec 026): se recuerda por usuario y empresa y se
// olvida al cerrar sesión.
const prompted = new Set<string>();

export const promptKey = (userId: number | undefined, companyId: number | null) => `${userId}:${companyId}`;
export const wasPrompted = (key: string) => prompted.has(key);
export const markPrompted = (key: string) => void prompted.add(key);
export const clearPrompted = () => prompted.clear();
