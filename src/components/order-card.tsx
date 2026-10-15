import { View } from "react-native";
import type { WorkOrder } from "@/api/types";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { StatusBadge } from "./status-badge";
import { StepsBar } from "./steps-bar";
import { AppText, Card, Icon } from "./ui";

/** Monograma de una persona: iniciales sobre un círculo tonal. */
export function Monogram({ name, size = 26 }: { name: string; size?: number }) {
  const { c } = useTheme();
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" }}>
      <AppText variant="label" style={{ color: c.onPrimarySoft, fontSize: size * 0.42, letterSpacing: 0 }}>
        {initials}
      </AppText>
    </View>
  );
}

/** Orden como hoja de servicio: talón con el folio a la izquierda y el contenido a la derecha. */
export function OrderCard({ order, onPress }: { order: WorkOrder; onPress: () => void }) {
  const { c } = useTheme();
  const progress = order.steps_count > 0 ? t("orders.progress", { done: order.steps_done, total: order.steps_count }) : null;
  const who = order.employee?.name ?? t("orders.unassigned");
  const urgent = order.priority === "urgent" || order.priority === "high";
  return (
    <Card
      onPress={onPress}
      style={{ padding: 0, flexDirection: "row", overflow: "hidden", gap: 0 }}
      accessibilityLabel={[order.title, t(`orders.status.${order.status}`), who, progress].filter(Boolean).join(", ")}
    >
      <View style={{ width: 64, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center", gap: space[1] }}>
        <AppText variant="label" tone="muted" style={{ fontSize: 11 }}>
          {"#"}
        </AppText>
        <AppText variant="figure" style={{ fontSize: 22, lineHeight: 24 }}>
          {order.id}
        </AppText>
        {/* perforación del talón */}
        <View style={{ position: "absolute", right: -1, top: 0, bottom: 0, justifyContent: "space-evenly" }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.surface, marginRight: -2.5 }} />
          ))}
        </View>
      </View>
      <View style={{ flex: 1, padding: space[4], gap: space[2] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space[2] }}>
          <AppText variant="title" style={{ flexShrink: 1 }} numberOfLines={2}>
            {order.title}
          </AppText>
          <StatusBadge status={order.status} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {order.employee ? <Monogram name={order.employee.name} /> : <Icon name="user-x" size={18} tone="muted" />}
          <AppText tone="muted" style={{ flexShrink: 1 }} numberOfLines={1}>
            {who}
          </AppText>
          {urgent ? (
            <View style={{ backgroundColor: c.marker, borderRadius: radius.chip - 6, paddingHorizontal: space[2], paddingVertical: 2 }}>
              <AppText variant="label" style={{ color: c.onMarker, fontSize: 11 }}>
                {t(`orders.priority.${order.priority}`).toUpperCase()}
              </AppText>
            </View>
          ) : null}
        </View>
        {progress ? (
          <View style={{ gap: space[1] }}>
            <StepsBar done={order.steps_done} total={order.steps_count} />
            <AppText variant="label" tone="muted" style={{ letterSpacing: 0.2 }}>
              {progress}
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
