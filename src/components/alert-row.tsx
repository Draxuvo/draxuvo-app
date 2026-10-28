import { useRouter } from "expo-router";
import { View } from "react-native";
import type { AlertKind, OperationalAlert, SnoozedAlert } from "@/api/types";
import { t, useLocale } from "@/i18n";
import { alertRoute, formatElapsed, formatMoney } from "@/lib/alerts";
import { shortTime } from "@/lib/time";
import { radius, space, useTheme } from "@/theme";
import { AppText, Button, Card, Icon, type IconName } from "./ui";

const ICONS: Record<AlertKind, IconName> = {
  kitchen_wait: "coffee",
  kitchen_preparing: "coffee",
  work_order_stalled: "clipboard",
  table_open: "clock",
  low_stock: "package",
};

interface Props {
  alert: OperationalAlert | SnoozedAlert;
  onSnooze?: () => void;
  onUnsnooze?: () => void;
  busy?: boolean;
}

/** Una alerta: qué es, cuánto lleva, a quién le toca y a dónde abrir (spec 045). */
export function AlertRow({ alert, onSnooze, onUnsnooze, busy }: Props) {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const snoozed = "snoozed_until" in alert ? alert : null;
  const critical = alert.severity === "critical";
  const route = alertRoute(alert);

  const owner = alert.owner ? t(`alerts.owner.${alert.owner.type}`, { name: alert.owner.name }) : null;
  const detail =
    alert.kind === "low_stock"
      ? t("alerts.stock", { stock: alert.stock ?? 0, min: alert.min_stock ?? 0 })
      : t("alerts.elapsed", { time: formatElapsed(alert.minutes ?? 0), limit: formatElapsed(alert.threshold_minutes ?? 0) });
  const total = alert.total != null ? t("alerts.total", { amount: formatMoney(alert.total) }) : null;

  return (
    <Card style={{ gap: space[3], opacity: snoozed ? 0.75 : 1 }} accessibilityLabel={`${alert.subject.label}. ${t(`alerts.kinds.${alert.kind}`)}. ${detail}`}>
      <View style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
        <View
          style={{ width: 40, height: 40, borderRadius: radius.chip, alignItems: "center", justifyContent: "center", backgroundColor: critical ? c.stampSoft : c.surfaceAlt }}
        >
          <Icon name={ICONS[alert.kind]} size={20} tone={critical ? "stamp" : "ink"} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{alert.subject.label}</AppText>
          <AppText tone="muted">{owner ? `${t(`alerts.kinds.${alert.kind}`)} · ${owner}` : t(`alerts.kinds.${alert.kind}`)}</AppText>
          <AppText tone="muted">{total ? `${detail} · ${total}` : detail}</AppText>
          {snoozed ? (
            <AppText tone="muted">
              {t("alerts.snooze.until", { time: shortTime(snoozed.snoozed_until) })}
              {snoozed.snoozed_by ? ` · ${t("alerts.snooze.by", { name: snoozed.snoozed_by })}` : ""}
            </AppText>
          ) : null}
        </View>
        <AppText variant="label" tone={critical ? "stamp" : "muted"}>
          {t(`alerts.severity.${alert.severity}`)}
        </AppText>
      </View>

      <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
        {route ? <Button label={t("alerts.open")} variant="outline" onPress={() => router.push(route as never)} style={{ flexGrow: 1 }} /> : null}
        {snoozed && onUnsnooze ? <Button label={t("alerts.snooze.undo")} variant="text" onPress={onUnsnooze} disabled={busy} /> : null}
        {!snoozed && alert.kind !== "low_stock" && onSnooze ? (
          <Button label={t("alerts.snooze.action")} variant="tonal" icon="bell-off" onPress={onSnooze} disabled={busy} style={{ flexGrow: 1 }} />
        ) : null}
      </View>
    </Card>
  );
}
