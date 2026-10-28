import { api } from "./client";
import type { AlertsResponse, OperationalAlert, SnoozableAlertKind, SnoozeMinutes } from "./types";

const base = "/api/v1/alerts";

/** La clave del elemento (lo que sigue a `<kind>:` en el id) identifica la alerta ante la API. */
export function alertSubjectKey(alert: Pick<OperationalAlert, "id" | "kind">): string {
  return alert.id.slice(alert.kind.length + 1);
}

/** Alertas activas de la empresa (spec 045); solo dueño y administrador, la API contesta 403 a los demás. */
export const listAlerts = (pageSize = 50) => api.get<AlertsResponse>(base, { query: { page_size: pageSize } });

export const snoozeAlert = (data: { kind: SnoozableAlertKind; subject_key: string; minutes: SnoozeMinutes }) =>
  api.post<{ id: string; snoozed_until: string; snoozed_by: string | null }>(`${base}/snooze`, { body: data });

export const unsnoozeAlert = (kind: SnoozableAlertKind, subjectKey: string) =>
  api.delete<void>(`${base}/snooze`, { query: { kind, subject_key: subjectKey } });
