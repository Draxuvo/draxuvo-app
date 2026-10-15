import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import type { WorkOrderStatus } from "@/api/types";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText } from "./ui";

/** Sello de estado. Con `animate`, cae sobre la hoja como un sello de goma al aparecer o cambiar. */
export function StatusBadge({ status, animate = false }: { status: WorkOrderStatus; animate?: boolean }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const tones: Record<WorkOrderStatus, { bg: string; fg: string; border: string }> = {
    open: { bg: "transparent", fg: c.ink, border: c.ink },
    in_progress: { bg: c.marker, fg: c.onMarker, border: c.marker },
    done: { bg: c.primarySoft, fg: c.onPrimarySoft, border: c.primary },
    paid: { bg: c.okSoft, fg: c.onOkSoft, border: c.ok },
    cancelled: { bg: c.surfaceAlt, fg: c.inkMuted, border: c.line },
  };
  const tone = tones[status];
  const label = t(`orders.status.${status}`);

  const drop = useSharedValue(animate && !reduced ? 0 : 1);
  useEffect(() => {
    if (!animate || reduced) return;
    drop.set(0);
    drop.set(withDelay(120, withSequence(withTiming(1.12, { duration: 150, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 160 }))));
  }, [status, animate, reduced, drop]);
  const style = useAnimatedStyle(() => ({
    opacity: drop.value === 0 ? 0 : 1,
    transform: [{ rotate: "-3deg" }, { scale: drop.value === 0 ? 2 : drop.value }],
  }));

  return (
    <Animated.View style={[{ alignSelf: "flex-start" }, style]}>
      <View
        accessible
        accessibilityLabel={label}
        style={{
          backgroundColor: tone.bg,
          borderColor: tone.border,
          borderWidth: 2,
          borderRadius: radius.chip - 6,
          paddingHorizontal: space[3],
          paddingVertical: space[1],
        }}
      >
        <AppText variant="label" style={{ color: tone.fg }}>
          {label.toUpperCase()}
        </AppText>
      </View>
    </Animated.View>
  );
}
