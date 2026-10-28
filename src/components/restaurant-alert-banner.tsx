import { Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RestaurantAlert } from "@/hooks/use-restaurant-alerts";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText, Icon, IconButton, type IconName } from "./ui";

/** Cuántos avisos se ven a la vez; el resto se resume en un contador. */
const MAX_VISIBLE = 3;

const ICON: Record<RestaurantAlert["kind"], IconName> = { ready: "bell", to_pay: "credit-card", table_taken: "users" };

function message(alert: RestaurantAlert): string {
  if (alert.kind === "ready") {
    const name = alert.item.quantity > 1 ? `${alert.item.quantity} × ${alert.item.name}` : alert.item.name;
    return alert.item.table
      ? t("ready.banner", { table: alert.item.table, name })
      : t("ready.bannerTakeout", { takeout: alert.item.takeout_name ?? "", name });
  }
  return alert.kind === "to_pay" ? t("restaurantAlerts.toPay", { name: alert.name }) : t("restaurantAlerts.tableTaken", { name: alert.name });
}

/** Avisos operativos del restaurante: artículo listo, cuenta por cobrar y mesa tomada por otra persona.
 *  Tocar uno abre la cuenta; la X lo descarta. */
export function RestaurantAlertBanner({
  alerts,
  onOpen,
  onDismiss,
}: {
  alerts: RestaurantAlert[];
  onOpen: (alert: RestaurantAlert) => void;
  onDismiss: (key: string) => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (alerts.length === 0) return null;
  const visible = alerts.slice(0, MAX_VISIBLE);
  const background: Record<RestaurantAlert["kind"], string> = { ready: c.ok, to_pay: c.primary, table_taken: c.stamp };

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + space[2], left: space[3], right: space[3], gap: space[2], zIndex: 50 }}>
      {visible.map((alert) => (
        <Animated.View
          key={alert.key}
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(160)}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: background[alert.kind], borderRadius: radius.card, paddingLeft: space[4], shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${message(alert)}. ${t("ready.open")}`}
            accessibilityLiveRegion="polite"
            onPress={() => onOpen(alert)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 56 }}
          >
            <Icon name={ICON[alert.kind]} tone="onPrimary" />
            <AppText variant="bodyStrong" tone="onPrimary" style={{ flex: 1 }} numberOfLines={2}>
              {message(alert)}
            </AppText>
          </Pressable>
          <IconButton icon="x" tone="onPrimary" label={t("ready.dismiss")} onPress={() => onDismiss(alert.key)} />
        </Animated.View>
      ))}
      {alerts.length > MAX_VISIBLE ? (
        <AppText variant="label" tone="muted" style={{ textAlign: "center" }}>
          +{alerts.length - MAX_VISIBLE}
        </AppText>
      ) : null}
    </View>
  );
}
