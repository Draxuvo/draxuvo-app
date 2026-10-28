import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAlerts, snoozeAlert, unsnoozeAlert } from "@/api/alerts";
import type { SnoozableAlertKind, SnoozeMinutes } from "@/api/types";
import { isBossRole, useSession } from "@/session";
import { useAppActive } from "./use-restaurant";

/** Las alertas se consultan cada 30 s mientras la app está activa (spec 045, research R8). */
export const ALERTS_POLL_MS = 30_000;

export function useAlertKeys() {
  const { companyId } = useSession();
  return { all: ["company", companyId, "alerts"] as const };
}

/** Solo dueño y administrador de la empresa activa ven alertas; para los demás ni se consulta. */
export function useCanSeeAlerts(): boolean {
  const { role, companyId } = useSession();
  return isBossRole(role) && companyId != null;
}

export function useAlerts({ pageSize = 50 }: { pageSize?: number } = {}) {
  const keys = useAlertKeys();
  const allowed = useCanSeeAlerts();
  const active = useAppActive();
  return useQuery({
    queryKey: [...keys.all, pageSize],
    queryFn: () => listAlerts(pageSize),
    enabled: allowed,
    refetchInterval: active ? ALERTS_POLL_MS : false,
    retry: false,
  });
}

export function useSnoozeAlert() {
  const qc = useQueryClient();
  const keys = useAlertKeys();
  return useMutation({
    mutationFn: (data: { kind: SnoozableAlertKind; subject_key: string; minutes: SnoozeMinutes }) => snoozeAlert(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUnsnoozeAlert() {
  const qc = useQueryClient();
  const keys = useAlertKeys();
  return useMutation({
    mutationFn: ({ kind, subjectKey }: { kind: SnoozableAlertKind; subjectKey: string }) => unsnoozeAlert(kind, subjectKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
