import { View } from "react-native";
import type { WorkOrder } from "@/api/types";
import { t } from "@/i18n";
import { StatusBadge } from "./status-badge";
import { AppText, Card } from "./ui";

export function OrderCard({ order, onPress }: { order: WorkOrder; onPress: () => void }) {
  const progress = order.steps_count > 0 ? t("orders.progress", { done: order.steps_done, total: order.steps_count }) : null;
  const who = order.employee?.name ?? t("orders.unassigned");
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[order.title, t(`orders.status.${order.status}`), who, progress].filter(Boolean).join(", ")}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <AppText variant="title" style={{ flexShrink: 1 }}>
          {order.title}
        </AppText>
        <StatusBadge status={order.status} />
      </View>
      <AppText muted>{who}</AppText>
      {progress ? <AppText muted>{progress}</AppText> : null}
    </Card>
  );
}
