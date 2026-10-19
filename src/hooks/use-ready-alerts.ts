import { useCallback, useEffect, useRef, useState } from "react";
import type { ReadyItem } from "@/api/types";
import { haptic } from "@/lib/haptics";
import { useTables } from "./use-restaurant";

/**
 * Avisos de "listo" para el mesero (FR-018): un aviso por cada artículo que pasa a listo en sus cuentas.
 * Lo ya avisado no se repite; un aviso se va solo cuando el artículo se entrega o se cancela.
 */
export function useReadyAlerts(enabled = true) {
  const tables = useTables(enabled);
  const [alerts, setAlerts] = useState<ReadyItem[]>([]);
  const seen = useRef(new Set<number>());
  const ready = tables.data?.ready_items;

  useEffect(() => {
    if (!ready) return;
    const current = new Set(ready.map((item) => item.id));
    const fresh = ready.filter((item) => !seen.current.has(item.id));
    fresh.forEach((item) => seen.current.add(item.id));
    setAlerts((list) => {
      const kept = list.filter((item) => current.has(item.id));
      return fresh.length > 0 || kept.length !== list.length ? [...kept, ...fresh] : list;
    });
    if (fresh.length > 0) haptic.success();
  }, [ready]);

  const dismiss = useCallback((id: number) => setAlerts((list) => list.filter((item) => item.id !== id)), []);
  return { alerts, dismiss };
}
