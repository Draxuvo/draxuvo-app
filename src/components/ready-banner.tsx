import { Pressable, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReadyItem } from "@/api/types";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText, Icon, IconButton } from "./ui";

const MAX_VISIBLE = 3;

function message(item: ReadyItem): string {
  const name = item.quantity > 1 ? `${item.quantity} × ${item.name}` : item.name;
  return item.table ? t("ready.banner", { table: item.table, name }) : t("ready.bannerTakeout", { takeout: item.takeout_name ?? "", name });
}

/** Avisos de lo que la cocina o la barra dejó listo. Tocar uno abre la cuenta; la X lo descarta. */
export function ReadyBanner({ alerts, onOpen, onDismiss }: { alerts: ReadyItem[]; onOpen: (item: ReadyItem) => void; onDismiss: (id: number) => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  if (alerts.length === 0) return null;
  const visible = alerts.slice(0, MAX_VISIBLE);

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + space[2], left: space[3], right: space[3], gap: space[2], zIndex: 50 }}>
      {visible.map((item) => (
        <Animated.View
          key={item.id}
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(160)}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.ok, borderRadius: radius.card, paddingLeft: space[4], shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${message(item)}. ${t("ready.open")}`}
            accessibilityLiveRegion="polite"
            onPress={() => onOpen(item)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 56 }}
          >
            <Icon name="bell" tone="onPrimary" />
            <AppText variant="bodyStrong" tone="onPrimary" style={{ flex: 1 }} numberOfLines={2}>
              {message(item)}
            </AppText>
          </Pressable>
          <IconButton icon="x" tone="onPrimary" label={t("ready.dismiss")} onPress={() => onDismiss(item.id)} />
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
