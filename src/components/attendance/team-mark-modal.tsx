import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { markEmployeeIn, markEmployeeOut } from "@/api/attendance";
import { describeError } from "@/components/error-view";
import { AppText, Button, Field, KeyboardFrame } from "@/components/ui";
import { t, useLocale } from "@/i18n";
import { toast } from "@/toast/store";
import { ToastHost } from "@/toast/toast-host";
import { radius, space, useTheme } from "@/theme";

const TIME_ZONE = "America/Mexico_City";
const OFFSET = "-06:00";
const TOLERANCE_MS = 60_000;

export interface TeamMarkTarget {
  employeeId: number;
  name: string;
  kind: "in" | "out";
}

/** Fecha (AAAA-MM-DD) y hora (HH:mm) de ahora en la zona del servidor. */
export function nowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** Hoja para marcar la entrada o la salida de otro empleado, con fecha y hora opcionales (spec 036). */
export function TeamMarkModal({ target, onClose }: { target: TeamMarkTarget | null; onClose: () => void }) {
  useLocale();
  const { c } = useTheme();
  const qc = useQueryClient();
  const initial = nowParts();
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shownDate = date ?? initial.date;
  const shownTime = time ?? initial.time;
  const changed = shownDate !== initial.date || shownTime !== initial.time;

  const close = () => {
    setDate(null);
    setTime(null);
    setError(null);
    onClose();
  };

  const mutation = useMutation({
    mutationFn: (at: string | undefined) => (target!.kind === "in" ? markEmployeeIn(target!.employeeId, at) : markEmployeeOut(target!.employeeId, at)),
    onSuccess: () => {
      toast.success(t(target!.kind === "in" ? "teamAttendance.doneIn" : "teamAttendance.doneOut", { name: target!.name }));
      void qc.invalidateQueries({ queryKey: ["roster"] });
      close();
    },
    onError: (e) => setError(describeError(e)),
  });

  const submit = () => {
    if (!changed) return mutation.mutate(undefined);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shownDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(shownTime)) return setError(t("teamAttendance.invalid"));
    const at = `${shownDate}T${shownTime}:00${OFFSET}`;
    const when = new Date(at).getTime();
    if (Number.isNaN(when)) return setError(t("teamAttendance.invalid"));
    if (when > Date.now() + TOLERANCE_MS) return setError(t("teamAttendance.future"));
    setError(null);
    mutation.mutate(at);
  };

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, justifyContent: "center", padding: space[5] }]}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={close} />
        <KeyboardFrame>
          <View accessibilityViewIsModal style={{ backgroundColor: c.surface, borderRadius: radius.sheet, padding: space[5], gap: space[4], width: "100%", maxWidth: 420, alignSelf: "center" }}>
            <View style={{ gap: space[2] }}>
              <AppText variant="title" accessibilityRole="header">
                {target ? t(target.kind === "in" ? "teamAttendance.sheetIn" : "teamAttendance.sheetOut", { name: target.name }) : ""}
              </AppText>
              <AppText tone="muted">{t("teamAttendance.sheetHint")}</AppText>
            </View>
            <Field label={t("teamAttendance.date")} value={shownDate} onChangeText={(v) => { setDate(v); setError(null); }} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
            <Field label={t("teamAttendance.time")} value={shownTime} onChangeText={(v) => { setTime(v); setError(null); }} autoCapitalize="none" keyboardType="numbers-and-punctuation" error={error} />
            {changed && !error ? <AppText tone="muted">{t("teamAttendance.capturedNote")}</AppText> : null}
            <View style={{ gap: space[2] }}>
              <Button label={target?.kind === "in" ? t("teamAttendance.markIn") : t("teamAttendance.markOut")} variant="primary" onPress={submit} loading={mutation.isPending} />
              <Button label={t("common.cancel")} variant="outline" onPress={close} disabled={mutation.isPending} />
            </View>
          </View>
        </KeyboardFrame>
        <ToastHost announce={false} />
      </View>
    </Modal>
  );
}
