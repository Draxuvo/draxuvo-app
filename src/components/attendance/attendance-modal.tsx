import { Modal, Pressable, StyleSheet, View } from "react-native";
import { AppText, Button } from "@/components/ui";
import { ToastHost } from "@/toast/toast-host";
import { radius, space, useTheme } from "@/theme";

export interface ModalAction {
  label: string;
  variant?: "primary" | "outline";
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/** Cuadro centrado con título, texto y botones apilados; lo usan la entrada y la salida (spec 026). */
export function AttendanceModal({ visible, title, body, actions, onDismiss }: { visible: boolean; title: string; body: string; actions: ModalAction[]; onDismiss: () => void }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, justifyContent: "center", padding: space[5] }]}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <View accessibilityViewIsModal style={{ backgroundColor: c.surface, borderRadius: radius.sheet, padding: space[5], gap: space[4], width: "100%", maxWidth: 420, alignSelf: "center" }}>
          <View style={{ gap: space[2] }}>
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            <AppText tone="muted">{body}</AppText>
          </View>
          <View style={{ gap: space[2] }}>
            {actions.map((action) => (
              <Button key={action.label} label={action.label} variant={action.variant ?? "outline"} onPress={action.onPress} loading={action.loading} disabled={action.disabled} />
            ))}
          </View>
        </View>
        <ToastHost announce={false} />
      </View>
    </Modal>
  );
}
