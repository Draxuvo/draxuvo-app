import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import type { WorkOrderStep } from "@/api/types";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { duration, space, useTheme } from "@/theme";
import { AppText, Divider, Icon } from "./ui";

function Box({ checked }: { checked: boolean }) {
  const { c } = useTheme();
  const on = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    on.set(checked ? withSpring(1, { damping: 10, stiffness: 260 }) : withTiming(0, { duration: duration.quick }));
  }, [checked, on]);
  const fill = useAnimatedStyle(() => ({ opacity: Math.min(on.value, 1), transform: [{ scale: 0.6 + 0.4 * on.value }] }));
  return (
    <View style={{ width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: checked ? c.ok : c.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.ok, alignItems: "center", justifyContent: "center" }, fill]}>
        <Icon name="check" size={18} tone="onPrimary" />
      </Animated.View>
    </View>
  );
}

/** Pasos de la orden. Solo se pueden marcar si la API lo permite (`check_steps`). */
export function StepList({
  steps,
  canCheck,
  busyStepId,
  onToggle,
}: {
  steps: WorkOrderStep[];
  canCheck: boolean;
  busyStepId?: number | null;
  onToggle: (step: WorkOrderStep) => void;
}) {
  if (steps.length === 0) return <AppText tone="muted">{t("orders.detail.stepsEmpty")}</AppText>;
  return (
    <View>
      {steps.map((step, index) => (
        <View key={step.id}>
          {index > 0 ? <Divider /> : null}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={step.description}
            accessibilityState={{ checked: step.done, disabled: !canCheck || busyStepId === step.id }}
            disabled={!canCheck || busyStepId === step.id}
            onPress={() => {
              if (step.done) haptic.tap();
              else haptic.success();
              onToggle(step);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: space[2] }}
          >
            <Box checked={step.done} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" tone={step.done ? "muted" : "ink"} style={step.done ? { textDecorationLine: "line-through" } : undefined}>
                {step.description}
              </AppText>
              {step.done && step.done_by ? (
                <AppText variant="label" tone="muted" style={{ letterSpacing: 0.2 }}>
                  {t("orders.detail.doneBy", { name: step.done_by.name })}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
