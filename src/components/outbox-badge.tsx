import { View } from "react-native";
import type { OutboxItem } from "@/outbox/db";
import { t } from "@/i18n";
import { colors, spacing } from "@/theme";
import { AppText, Button } from "./ui";

const LABEL: Record<OutboxItem["state"], string> = {
  pending: "orders.outbox.pending",
  sending: "orders.outbox.sending",
  failed: "orders.outbox.failed",
  discardable: "orders.outbox.discardable",
};

/** Estado de un pendiente; si ya no se puede enviar o falló, ofrece reintentar o descartar. */
export function OutboxBadge({ item, onRetry, onDiscard }: { item: OutboxItem; onRetry: () => void; onDiscard: () => void }) {
  const problem = item.state === "failed" || item.state === "discardable";
  return (
    <View style={{ gap: spacing[2] }}>
      <AppText variant="label" style={{ color: problem ? colors.alerta : colors.grisTexto }} accessibilityLiveRegion="polite">
        {t(LABEL[item.state]).toUpperCase()}
      </AppText>
      {problem ? (
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          {item.state === "failed" ? (
            <View style={{ flex: 1 }}>
              <Button label={t("orders.outbox.retry")} variant="outline" onPress={onRetry} />
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
