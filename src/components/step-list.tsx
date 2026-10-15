import { Pressable, View } from "react-native";
import type { WorkOrderStep } from "@/api/types";
import { t } from "@/i18n";
import { colors, MIN_TOUCH, radii, spacing } from "@/theme";
import { AppText } from "./ui";

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
  if (steps.length === 0) return <AppText muted>{t("orders.detail.stepsEmpty")}</AppText>;
  return (
    <View style={{ gap: spacing[2] }}>
      {steps.map((step) => (
        <Pressable
          key={step.id}
          accessibilityRole="checkbox"
          accessibilityLabel={step.description}
          accessibilityState={{ checked: step.done, disabled: !canCheck || busyStepId === step.id }}
          disabled={!canCheck || busyStepId === step.id}
          onPress={() => onToggle(step)}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], minHeight: MIN_TOUCH }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: radii.interior,
              borderWidth: 2,
              borderColor: colors.tinta,
              backgroundColor: step.done ? colors.sello : colors.etiqueta,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {step.done ? <AppText style={{ color: colors.etiqueta }}>✓</AppText> : null}
          </View>
          <View style={{ flex: 1 }}>
            <AppText style={step.done ? { textDecorationLine: "line-through" } : undefined}>{step.description}</AppText>
            {step.done && step.done_by ? (
              <AppText variant="label" muted>
                {t("orders.detail.doneBy", { name: step.done_by.name })}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
