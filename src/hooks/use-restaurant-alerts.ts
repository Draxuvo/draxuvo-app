import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReadyItem, TableState, TablesResponse } from "@/api/types";
import { haptic } from "@/lib/haptics";
import { playReadySound } from "@/lib/sound";
import { useSoundPreference } from "./use-sound-preference";
import { useTables } from "./use-restaurant";

export type RestaurantAlert =
  | { kind: "ready"; key: string; item: ReadyItem }
  | { kind: "to_pay"; key: string; checkId: number; name: string }
  | { kind: "table_taken"; key: string; checkId: number; name: string };

const readyKey = (id: number) => `ready:${id}`;
const toPayKey = (id: number) => `to_pay:${id}`;
const tableKey = (id: number) => `table:${id}`;

interface NamedCheck {
  id: number;
  name: string;
}

/** Cuentas propias que ya no tienen nada pendiente y quedaron por cobrar (spec 043, FR-015). */
function toPayChecks(data: TablesResponse): NamedCheck[] {
  const out: NamedCheck[] = [];
  for (const table of data.results) {
    if (table.state === "to_pay" && table.check?.mine) out.push({ id: table.check.id, name: table.name });
  }
  for (const takeout of data.takeouts) {
    const { counts } = takeout;
    if (takeout.mine && counts.new + counts.preparing + counts.ready === 0 && counts.delivered > 0) {
      out.push({ id: takeout.id, name: takeout.takeout_name });
    }
  }
  return out;
}

/**
 * Avisos operativos de restaurante del teléfono (spec 043, US5, US6 y US8): artículo listo, cuenta por
 * cobrar y mesa tomada por otra persona. La carga inicial no avisa: solo se registra lo que ya estaba
 * así; un aviso descartado no vuelve por el mismo evento y se va solo cuando el evento termina.
 */
export function useRestaurantAlerts(enabled = true) {
  const tables = useTables(enabled);
  const sound = useSoundPreference("ready");
  const data = tables.data;
  // `null` hasta la primera respuesta: la carga inicial no genera avisos.
  const [announced, setAnnounced] = useState<Set<string>>(() => new Set());
  const [taken, setTaken] = useState<Map<string, NamedCheck>>(() => new Map());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const seen = useRef<Set<string> | null>(null);
  const tableStates = useRef<Map<number, TableState> | null>(null);

  useEffect(() => {
    if (!data) return;

    const present = new Set<string>();
    for (const item of data.ready_items) present.add(readyKey(item.id));
    for (const check of toPayChecks(data)) present.add(toPayKey(check.id));
    if (seen.current) {
      const fresh = [...present].filter((key) => !seen.current!.has(key));
      if (fresh.length) {
        setAnnounced((prev) => new Set([...prev, ...fresh]));
        if (data.ready_items.some((item) => fresh.includes(readyKey(item.id)))) {
          haptic.success();
          if (sound.enabled) playReadySound(sound.volume);
        }
      }
    }
    seen.current = present;
    setAnnounced((prev) => {
      const next = new Set([...prev].filter((key) => present.has(key)));
      return next.size === prev.size ? prev : next;
    });

    // Una mesa que estaba libre y ahora tiene una cuenta ajena: la tomó otra persona.
    const next = new Map<number, TableState>();
    for (const table of data.results) next.set(table.id, table.state ?? (table.check ? "occupied" : "free"));
    const before = tableStates.current;
    tableStates.current = next;
    if (!before) return;
    const opened = data.results.filter(
      (table) => table.active && before.get(table.id) === "free" && next.get(table.id) === "occupied" && table.check && !table.check.mine,
    );
    if (opened.length) {
      setTaken((prev) => {
        const copy = new Map(prev);
        for (const table of opened) copy.set(tableKey(table.id), { id: table.check!.id, name: table.name });
        return copy;
      });
    }
  }, [data, sound.enabled, sound.volume]);

  const alerts = useMemo<RestaurantAlert[]>(() => {
    if (!data) return [];
    const list: RestaurantAlert[] = [];
    for (const item of data.ready_items) {
      const key = readyKey(item.id);
      if (announced.has(key) && !dismissed.has(key)) list.push({ kind: "ready", key, item });
    }
    for (const check of toPayChecks(data)) {
      const key = toPayKey(check.id);
      if (announced.has(key) && !dismissed.has(key)) list.push({ kind: "to_pay", key, checkId: check.id, name: check.name });
    }
    // El aviso de mesa tomada sigue mientras esa cuenta siga abierta y sea de otra persona.
    for (const [key, value] of taken) {
      if (dismissed.has(key)) continue;
      const table = data.results.find((t) => t.id === Number(key.slice("table:".length)));
      if (table?.check?.id === value.id && !table.check.mine) list.push({ kind: "table_taken", key, checkId: value.id, name: value.name });
    }
    return list;
  }, [data, announced, taken, dismissed]);

  const dismiss = useCallback((key: string) => setDismissed((prev) => new Set(prev).add(key)), []);
  return { alerts, dismiss };
}
