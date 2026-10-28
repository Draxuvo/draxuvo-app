import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReadyItem, TableState, TablesResponse } from "@/api/types";
import { haptic } from "@/lib/haptics";
import { playReadySound } from "@/lib/sound";
import { resolve } from "@/lib/sounds/choices";
import { useSoundChoices } from "./use-sound-choices";
import { useSoundPreference } from "./use-sound-preference";
import { useTables } from "./use-restaurant";

export type RestaurantAlert =
  | { kind: "ready"; key: string; item: ReadyItem }
  | { kind: "to_pay"; key: string; checkId: number; name: string }
  | { kind: "table_taken"; key: string; checkId: number; name: string };

export interface NamedCheck {
  id: number;
  name: string;
}

/** Lo que trae un sondeo respecto al anterior. */
export interface AlertsDelta {
  /** Claves de los eventos presentes ahora (para dejar de anunciar los que se fueron). */
  present: Set<string>;
  /** Eventos nuevos que se anuncian; en la carga inicial (`prev === null`) va vacío. */
  fresh: string[];
  /** Mesas que pasaron de libres a ocupadas por otra persona. */
  opened: { key: string; check: NamedCheck }[];
  /** Apareció un artículo listo: toca sonar y vibrar. */
  freshReady: boolean;
}

const readyKey = (id: number) => `ready:${id}`;
const toPayKey = (id: number) => `to_pay:${id}`;
const tableKey = (id: number) => `table:${id}`;

/** Cuentas propias que ya no tienen nada pendiente y quedaron por cobrar (spec 043, FR-015). */
export function toPayChecks(data: TablesResponse): NamedCheck[] {
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

/** Claves de los eventos presentes en un sondeo. */
export function presentKeys(data: TablesResponse): Set<string> {
  const keys = new Set<string>();
  for (const item of data.ready_items) keys.add(readyKey(item.id));
  for (const check of toPayChecks(data)) keys.add(toPayKey(check.id));
  return keys;
}

/** Estado de cada mesa según el sondeo. */
function tableStates(data: TablesResponse): Map<number, TableState> {
  const map = new Map<number, TableState>();
  for (const table of data.results) map.set(table.id, table.state ?? (table.check ? "occupied" : "free"));
  return map;
}

/**
 * Diferencia entre dos sondeos (spec 043, US5, US6 y US8). Con `prev === null` es la carga inicial:
 * solo se registra lo que ya estaba así y no se anuncia nada.
 */
export function alertsDelta(prev: TablesResponse | null, data: TablesResponse): AlertsDelta {
  const present = presentKeys(data);
  if (!prev) return { present, fresh: [], opened: [], freshReady: false };

  const before = presentKeys(prev);
  const fresh = [...present].filter((key) => !before.has(key));

  const states = tableStates(data);
  const beforeStates = tableStates(prev);
  // Una mesa que estaba libre y ahora tiene una cuenta ajena: la tomó otra persona.
  const opened = data.results
    .filter((table) => table.active && beforeStates.get(table.id) === "free" && states.get(table.id) === "occupied" && table.check && !table.check.mine)
    .map((table) => ({ key: tableKey(table.id), check: { id: table.check!.id, name: table.name } }));

  return { present, fresh, opened, freshReady: fresh.some((key) => key.startsWith("ready:")) };
}

/**
 * Avisos operativos de restaurante del teléfono (spec 043, US5, US6 y US8): artículo listo, cuenta por
 * cobrar y mesa tomada por otra persona. La carga inicial no avisa: solo se registra lo que ya estaba
 * así; un aviso descartado no vuelve por el mismo evento y se va solo cuando el evento termina.
 */
export function useRestaurantAlerts(enabled = true) {
  const tables = useTables(enabled);
  const sound = useSoundPreference("ready");
  const { choices } = useSoundChoices();
  const data = tables.data;
  const [announced, setAnnounced] = useState<Set<string>>(() => new Set());
  const [taken, setTaken] = useState<Map<string, NamedCheck>>(() => new Map());
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const processed = useRef<TablesResponse | null>(null);
  const readyToSound = useRef(false);

  useEffect(() => {
    if (!data) return;
    const delta = alertsDelta(processed.current, data);
    processed.current = data;
    if (delta.freshReady) readyToSound.current = true;
    setAnnounced((current) => {
      const kept = new Set([...current].filter((key) => delta.present.has(key)));
      for (const key of delta.fresh) kept.add(key);
      return kept.size === current.size ? current : kept;
    });
    if (delta.opened.length) {
      setTaken((current) => {
        const next = new Map(current);
        for (const { key, check } of delta.opened) next.set(key, check);
        return next;
      });
    }
  }, [data]);

  // El sonido y la vibración van aparte: son un aviso puntual, no estado.
  useEffect(() => {
    if (!readyToSound.current) return;
    readyToSound.current = false;
    haptic.success();
    if (sound.enabled) playReadySound(sound.volume, resolve("ready", choices));
  }, [data, sound.enabled, sound.volume, choices]);

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
