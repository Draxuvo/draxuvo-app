import { Modal, Pressable, StyleSheet, View } from "react-native";
import type { SnoozeMinutes } from "@/api/types";
import { t, useLocale } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { ToastHost } from "@/toast/toast-host";
import { AppText, Button } from "./ui";

const OPTIONS: { minutes: SnoozeMinutes; key: "m30" | "m60" | "m120" }[] = [
  { minutes: 30, key: "m30" },
  { minutes: 60, key: "m60" },
  { minutes: 120, key: "m120" },
];

/** Hoja para elegir cuánto posponer una alerta de tiempo: 30 min, 1 h o 2 h (spec 045, FR-005a). */
export function SnoozeSheet({ visible, onPick, onClose }: { visible: boolean; onPick: (minutes: SnoozeMinutes) => void; onClose: () => void }) {
  useLocale();
  const { c } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, justifyContent: "center", padding: space[5] }]}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          accessibilityViewIsModal
          style={{ backgroundColor: c.surface, borderRadius: radius.sheet, padding: space[5], gap: space[4], width: "100%", maxWidth: 420, alignSelf: "center" }}
        >
          <View style={{ gap: space[2] }}>
            <AppText variant="title" accessibilityRole="header">
              {t("alerts.snooze.title")}
            </AppText>
            <AppText tone="muted">{t("alerts.snooze.hint")}</AppText>
          </View>
          <View style={{ gap: space[2] }}>
            {OPTIONS.map(({ minutes, key }) => (
              <Button key={minutes} label={t(`alerts.snooze.${key}`)} variant="tonal" onPress={() => onPick(minutes)} />
            ))}
            <Button label={t("alerts.snooze.cancel")} variant="text" onPress={onClose} />
          </View>
        </View>
        <ToastHost />
      </View>
    </Modal>
  );
}
