/** Pesos con dos decimales: `$1,234.50`. */
export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Lee lo que escribe la persona (`1,200.5`, `$ 300`); `null` si no es un monto válido. */
export function parseMoney(text: string): number | null {
  const cleaned = text.replace(/[$\s,]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Cambio por devolver o faltante por pedir, en centavos exactos. */
export function changeOrMissing(total: number, received: number): { change: number; missing: number } {
  const diff = Math.round((received - total) * 100) / 100;
  return diff >= 0 ? { change: diff, missing: 0 } : { change: 0, missing: -diff };
}
