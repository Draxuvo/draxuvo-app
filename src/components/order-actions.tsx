import { useRouter } from "expo-router";
import { Alert, View } from "react-native";
import type { WorkOrder } from "@/api/types";
import { useOrderTransition } from "@/hooks/use-orders";
import { t } from "@/i18n";
import { colors, spacing } from "@/theme";
import { AppText, Button } from "./ui";

/**
 * Botones de la orden. Solo se dibuja lo que la API manda en `allowed_actions`: la app no
 * copia la matriz de roles (FR-006).
 */
export function OrderActions({ order, onError }: { order: WorkOrder; onError: (error: unknown) => void }) {
  const router = useRouter();
  const transition = useOrderTransition(order.id);
  const allowed = order.allowed_actions ?? [];
  const pendingSteps = order.steps_count - order.steps_done;

  const run = (action: "start" | "finish" | "reopen") => transition.mutate(action, { onError });

  const finish = () => {
    if (pendingSteps <= 0) return run("finish");
    Alert.alert(t("orders.actions.pendingStepsTitle"), t("orders.actions.pendingStepsBody", { count: pendingSteps }), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("orders.actions.finishAnyway"), onPress: () => run("finish") },
    ]);
  };

  const buttons = [
    allowed.includes("start") && <Button key="start" label={t("orders.actions.start")} loading={transition.isPending} onPress={() => run("start")} />,
    allowed.includes("finish") && <Button key="finish" label={t("orders.actions.finish")} loading={transition.isPending} onPress={finish} />,
    allowed.includes("reopen") && <Button key="reopen" label={t("orders.actions.reopen")} variant="outline" loading={transition.isPending} onPress={() => run("reopen")} />,
    allowed.includes("charge") && (
      <Button
        key="charge"
        label={t("orders.actions.charge")}
        disabled={order.charge_blocked_reason === "no_items"}
        onPress={() => router.push(`/cobro/${order.id}` as never)}
      />
    ),
  ].filter(Boolean);

  if (buttons.length === 0) return null;
  return (
    <View style={{ gap: spacing[2] }}>
      {allowed.includes("charge") && order.charge_blocked_reason === "no_items" ? (
        <AppText variant="label" style={{ color: colors.alerta }}>
          {t("orders.actions.chargeBlocked")}
        </AppText>
      ) : null}
      {buttons}
    </View>
  );
}
