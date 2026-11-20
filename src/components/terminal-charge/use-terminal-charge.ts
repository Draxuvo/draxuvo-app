import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import {
  abandonTerminalCharge,
  cancelTerminalCharge,
  createTerminalCharge,
  getTerminalCharge,
  type TerminalChargeInput,
} from "@/api/terminal-charges";
import type { PaymentTerminal, TerminalCharge } from "@/api/types";

const WAITING = new Set(["pending", "canceling", "approved"]);
export const POLL_MS = 2000;

export interface TerminalChargeError {
  code: string;
  terminalChargeId?: number;
  pending?: number;
}

/** ¿Se le pueden mandar cobros? (integrada, activa y con la conexión al corriente; spec 069) */
export const isIntegrated = (terminal: PaymentTerminal | undefined | null) => !!terminal && terminal.chargeable === true;

function toError(error: unknown): TerminalChargeError {
  if (error instanceof ApiError && error.code) {
    const details = error.details as { terminal_charge_id?: number; pending?: number } | null;
    return { code: error.code, terminalChargeId: details?.terminal_charge_id, pending: details?.pending };
  }
  return { code: "generic" };
}

/**
 * Una solicitud de cobro en terminal integrada (spec 069, US1): la crea, la consulta cada 2 s mientras espera y avisa una
 * sola vez cuando se aplica. Sondea por su cuenta (sin React Query) para que los formularios funcionen en cualquier
 * pantalla, también en las pruebas que no montan un cliente de consultas.
 */
export function useTerminalCharge({
  onApplied,
  onStartError,
}: {
  onApplied: (charge: TerminalCharge) => void;
  onStartError?: (error: TerminalChargeError) => boolean;
}) {
  const [chargeId, setChargeId] = useState<number | null>(null);
  const [charge, setCharge] = useState<TerminalCharge | null>(null);
  const [starting, setStarting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [startError, setStartError] = useState<TerminalChargeError | null>(null);
  const applied = useRef<number | null>(null);
  const callbacks = useRef({ onApplied, onStartError });
  useEffect(() => {
    callbacks.current = { onApplied, onStartError };
  });

  const refresh = useCallback(async (id: number) => {
    try {
      const next = await getTerminalCharge(id);
      setCharge(next);
      if (next.status === "applied" && applied.current !== next.id) {
        applied.current = next.id;
        callbacks.current.onApplied(next);
      }
      return next;
    } catch {
      return null; // Sin red: se vuelve a intentar en la siguiente vuelta.
    }
  }, []);

  useEffect(() => {
    if (chargeId == null) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      const next = await refresh(chargeId);
      if (!stopped && (!next || WAITING.has(next.status))) timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [chargeId, refresh]);

  const start = (input: TerminalChargeInput) => {
    setStartError(null);
    setStarting(true);
    createTerminalCharge(input)
      .then((created) => {
        setCharge(created);
        setChargeId(created.id);
      })
      .catch((error: unknown) => {
        const parsed = toError(error);
        if (parsed.code === "terminal_charge_pending" && parsed.terminalChargeId) return void setChargeId(parsed.terminalChargeId);
        if (callbacks.current.onStartError?.(parsed)) return;
        setStartError(parsed);
      })
      .finally(() => setStarting(false));
  };

  const clear = () => {
    setChargeId(null);
    setCharge(null);
    setStartError(null);
  };

  return {
    charge: chargeId != null ? charge : null,
    starting,
    startError,
    active: chargeId != null || starting || startError != null,
    start,
    cancel: () => {
      if (!charge) return;
      setCanceling(true);
      cancelTerminalCharge(charge.id)
        .then(setCharge)
        .catch((error: unknown) => setStartError(toError(error)))
        .finally(() => setCanceling(false));
    },
    canceling,
    abandon: async () => {
      if (charge && (charge.status === "pending" || charge.status === "canceling")) await abandonTerminalCharge(charge.id);
      clear();
    },
    reset: clear,
  };
}
