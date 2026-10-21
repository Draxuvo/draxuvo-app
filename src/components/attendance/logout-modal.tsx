import { useState } from "react";
import { describeError } from "@/components/error-view";
import { useAttendance } from "@/hooks/use-attendance";
import { t, useLocale } from "@/i18n";
import { useSession } from "@/session";
import { toast } from "@/toast/store";
import { AttendanceModal } from "./attendance-modal";

/**
 * Cerrar sesión con un turno abierto ofrece marcar la salida (spec 026). `requestLogout` pregunta si hay turno
 * abierto; `modal` se dibuja donde se use.
 */
export function useLogoutFlow() {
  useLocale();
  const { signOut } = useSession();
  const { state, markOut } = useAttendance();
  const [open, setOpen] = useState(false);

  const requestLogout = () => (state === "working" ? setOpen(true) : void signOut());

  const markAndLogout = () =>
    markOut.mutate(undefined, {
      onSuccess: () => void signOut(),
      onError: (error) => toast.error(describeError(error)),
    });

  const modal = (
    <AttendanceModal
      visible={open}
      title={t("attendance.logout.title")}
      body={t("attendance.logout.body")}
      onDismiss={() => setOpen(false)}
      actions={[
        { label: t("attendance.logout.markAndLogout"), variant: "primary", onPress: markAndLogout, loading: markOut.isPending },
        { label: t("attendance.logout.withoutMarking"), onPress: () => void signOut(), disabled: markOut.isPending },
        { label: t("common.cancel"), onPress: () => setOpen(false), disabled: markOut.isPending },
      ]}
    />
  );

  return { requestLogout, modal };
}
