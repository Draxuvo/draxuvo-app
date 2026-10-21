import { useState } from "react";
import { markPrompted, promptKey, wasPrompted } from "@/attendance/prompted";
import { describeError } from "@/components/error-view";
import { useAttendance } from "@/hooks/use-attendance";
import { t, useLocale } from "@/i18n";
import { shortTime } from "@/lib/time";
import { useSession } from "@/session";
import { toast } from "@/toast/store";
import { AttendanceModal } from "./attendance-modal";

/** Modal "Marcar entrada" al iniciar sesión: una vez por sesión y se puede omitir (spec 026). */
export function EntryModal() {
  useLocale();
  const { user, companyId } = useSession();
  const { data, eligible, state, markIn } = useAttendance();
  const key = promptKey(user?.id, companyId);
  const [closedKey, setClosedKey] = useState<string | null>(null);

  const visible = eligible && state !== "working" && closedKey !== key && !wasPrompted(key);

  const close = () => {
    markPrompted(key);
    setClosedKey(key);
  };

  const mark = () =>
    markIn.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("attendance.entry.done"));
        close();
      },
      onError: (error) => toast.error(describeError(error)),
    });

  return (
    <AttendanceModal
      visible={visible}
      title={t("attendance.entry.title")}
      body={t("attendance.entry.body", { time: data ? shortTime(data.server_time) : "" })}
      onDismiss={close}
      actions={[
        { label: t("attendance.entry.mark"), variant: "primary", onPress: mark, loading: markIn.isPending },
        { label: t("attendance.entry.later"), onPress: close, disabled: markIn.isPending },
      ]}
    />
  );
}
