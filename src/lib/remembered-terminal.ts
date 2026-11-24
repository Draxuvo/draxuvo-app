// src/lib/remembered-terminal.ts — la terminal habitual de este teléfono (spec 069, US4, FR-025, research R11).
// Se guarda por empresa con la misma llave que el panel (`draxuvo.terminal.<companyId>`), en el almacenamiento del
// dispositivo. Si no se puede leer o la terminal ya no está activa, no se propone ninguna y se pide elegir.
import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import type { PaymentTerminal } from "@/api/types";
import { useActiveCompanyId } from "@/session";

const PREFIX = "draxuvo.terminal.";

const keyFor = (companyId: number) => `${PREFIX}${companyId}`;

export async function readRememberedTerminal(companyId: number | null): Promise<number | null> {
  if (companyId == null) return null;
  try {
    const raw = await SecureStore.getItemAsync(keyFor(companyId));
    const id = raw ? Number(raw) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function rememberTerminal(companyId: number | null, terminalId: number | null | undefined): Promise<void> {
  if (companyId == null || terminalId == null) return;
  try {
    await SecureStore.setItemAsync(keyFor(companyId), String(terminalId));
  } catch {
    // Sin almacenamiento: no se recuerda.
  }
}

/** La terminal que se propone al cobrar: la única que hay, o la última usada en este teléfono si sigue activa. */
export function defaultTerminalFor(terminals: PaymentTerminal[], remembered: number | null): number | null {
  if (terminals.length === 1) return terminals[0].id;
  return remembered != null && terminals.some((t) => t.id === remembered && t.active !== false) ? remembered : null;
}

/** Terminal propuesta para esta empresa y una función para recordar la que se usó al confirmar un pago con tarjeta. */
export function useRememberedTerminal(terminals: PaymentTerminal[]) {
  const companyId = useActiveCompanyId();
  const [remembered, setRemembered] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void readRememberedTerminal(companyId).then((id) => {
      if (alive) setRemembered(id);
    });
    return () => {
      alive = false;
    };
  }, [companyId]);

  const remember = useCallback(
    (terminalId: number | null | undefined) => {
      if (terminalId == null) return;
      setRemembered(terminalId);
      void rememberTerminal(companyId, terminalId);
    },
    [companyId],
  );

  return { defaultTerminal: defaultTerminalFor(terminals, remembered), remember };
}
