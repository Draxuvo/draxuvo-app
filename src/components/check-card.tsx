import { View } from "react-native";
import type { CheckSummary } from "@/api/types";
import { t } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { tableLabel } from "@/lib/table-label";
import { space } from "@/theme";
import { AppText, Card } from "./ui";

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

/** Cuenta de mesa abierta dentro de la lista de Órdenes (spec 023): mesa o nombre para llevar, total, mesero y tiempo abierta. */
export function CheckCard({ name, takeout, check, onPress }: { name: string; takeout: boolean; check: CheckSummary; onPress: () => void }) {
  const title = takeout ? t("orders.openChecks.takeout", { name }) : tableLabel("orders.openChecks.table", name);
  const elapsed = t("orders.openChecks.elapsed", { time: t("tables.elapsed", { minutes: minutesSince(check.opened_at) }) });
  const waiter = check.waiter ? `${t("orders.openChecks.waiter", { name: check.waiter.name })} · ` : "";
  return (
    <Card onPress={onPress} accessibilityLabel={t("orders.openChecks.open", { name })} style={{ minHeight: 72, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[3] }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline" numberOfLines={1}>
            {title}
          </AppText>
          <AppText tone="muted" numberOfLines={1}>
            {waiter}
            {elapsed}
          </AppText>
        </View>
        <AppText variant="figure">{formatMoney(check.total)}</AppText>
      </View>
    </Card>
  );
}
