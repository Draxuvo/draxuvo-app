import { View } from "react-native";
import type { OutboxItem } from "@/outbox/db";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText, Button, Icon, type IconName } from "./ui";

const LABEL: Record<OutboxItem["state"], string> = {
  pending: "orders.outbox.pending",
  sending: "orders.outbox.sending",
  failed: "orders.outbox.failed",
  discardable: "orders.outbox.discardable",
};
const ICON: Record<OutboxItem["state"], IconName> = {
  pending: "clock",
  sending: "upload-cloud",
  failed: "alert-triangle",
  discardable: "slash",
};

/** Estado de un pendiente; si ya no se puede enviar o falló, ofrece reintentar o descartar. */
export function OutboxBadge({ item, onRetry, onDiscard }: { item: OutboxItem; onRetry: () => void; onDiscard: () => void }) {
  const { c } = useTheme();
  const problem = item.state === "failed" || item.state === "discardable";
  return (
    <View style={{ gap: space[2] }}>
      <View
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: space[1],
          borderRadius: radius.pill,
          paddingHorizontal: space[2],
          paddingVertical: 2,
          backgroundColor: problem ? c.stampSoft : c.surfaceAlt,
        }}
      >
        <Icon name={ICON[item.state]} size={13} tone={problem ? "stamp" : "muted"} />
        <AppText variant="label" tone={problem ? "stamp" : "muted"} accessibilityLiveRegion="polite" style={{ fontSize: 11 }}>
          {t(LABEL[item.state]).toUpperCase()}
        </AppText>
      </View>
      {problem ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {item.state === "failed" ? (
            <View style={{ flex: 1 }}>
              <Button label={t("orders.outbox.retry")} variant="tonal" onPress={onRetry} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button label={t("orders.outbox.discard")} variant="outline" onPress={onDiscard} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
