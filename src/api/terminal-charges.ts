import { api } from "./client";
import type { TerminalCharge, TerminalChargeOwnerType } from "./types";

const base = "/api/v1/terminal_charges";

export interface TerminalChargeInput {
  terminal_id: number;
  amount: number;
  owner: { type: TerminalChargeOwnerType; id: number };
  /** Lo demás del cobro de siempre: otros pagos (orden) o `confirm_incomplete` (cuenta). */
  params?: Record<string, unknown>;
}

/** Solicitudes de cobro en terminales integradas (spec 069, contracts/api.md). */
export const createTerminalCharge = ({ terminal_id, amount, owner, params = {} }: TerminalChargeInput) =>
  api.post<TerminalCharge>(base, { body: { terminal_id, amount, [`${owner.type}_id`]: owner.id, params } });

export const getTerminalCharge = (id: number) => api.get<TerminalCharge>(`${base}/${id}`);

export const cancelTerminalCharge = (id: number) => api.post<TerminalCharge>(`${base}/${id}/cancel`, {});

export const abandonTerminalCharge = (id: number) => api.post<TerminalCharge>(`${base}/${id}/abandon`, {});
