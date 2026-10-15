import { StyleSheet, View } from "react-native";
import type { WorkOrderStatus } from "@/api/types";
import { t } from "@/i18n";
import { colors, radii, spacing } from "@/theme";
import { AppText } from "./ui";

const TONES: Record<WorkOrderStatus, { bg: string; fg: string }> = {
  open: { bg: colors.anaquel, fg: colors.tinta },
  in_progress: { bg: colors.ceja, fg: colors.tinta },
  done: { bg: colors.oferta, fg: colors.tinta },
  paid: { bg: colors.sello, fg: colors.etiqueta },
  cancelled: { bg: colors.graficaNeutra, fg: colors.etiqueta },
};

export function StatusBadge({ status }: { status: WorkOrderStatus }) {
  const tone = TONES[status];
  const label = t(`orders.status.${status}`);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]} accessible accessibilityLabel={label}>
      <AppText variant="label" style={{ color: tone.fg }}>
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: radii.pastilla, paddingHorizontal: spacing[3], paddingVertical: spacing[1] },
});
