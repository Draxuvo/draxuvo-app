import { View } from "react-native";
import { describeError } from "@/components/error-view";
import { AppText, Button, Card, Icon } from "@/components/ui";
import { useAttendance } from "@/hooks/use-attendance";
import { t, useLocale } from "@/i18n";
import { shortTime } from "@/lib/time";
import { space } from "@/theme";
import { toast } from "@/toast/store";

/** Estado de hoy y el botón para marcar entrada o salida (spec 026). No se pinta si la persona no es empleada. */
export function AttendanceCard() {
  useLocale();
  const { data, eligible, state, markIn, markOut } = useAttendance();
  if (!eligible || !state || !data) return null;

  const working = state === "working" && data.current;
  const summary = working
    ? t("attendance.status.working", { time: shortTime(data.current!.checkin_at) })
    : state === "done" && data.last?.checkout_at
      ? t("attendance.status.done", { time: shortTime(data.last.checkout_at) })
      : t("attendance.status.none");
  const onError = (error: unknown) => toast.error(describeError(error));

  return (
    <Card style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Icon name="clock" tone="muted" />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{t("attendance.title")}</AppText>
          <AppText tone="muted">{summary}</AppText>
        </View>
      </View>
      {working ? (
        <Button
          label={t("attendance.status.markOut")}
          variant="outline"
          icon="log-out"
          loading={markOut.isPending}
          onPress={() => markOut.mutate(undefined, { onSuccess: () => toast.success(t("attendance.status.checkedOut")), onError })}
        />
      ) : (
        <Button
          label={t("attendance.status.markIn")}
          icon="log-in"
          loading={markIn.isPending}
          onPress={() => markIn.mutate(undefined, { onSuccess: () => toast.success(t("attendance.entry.done")), onError })}
        />
      )}
    </Card>
  );
}
