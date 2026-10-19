import { View } from "react-native";
import type { CheckSummary } from "@/api/types";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText, Card } from "./ui";

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

/** Casilla de una mesa o de una cuenta para llevar: libre, o quién la atiende y qué está listo. */
export function TableTile({ name, check, onPress }: { name: string; check: CheckSummary | null; onPress: () => void }) {
  const { c } = useTheme();
  const ready = check?.counts.ready ?? 0;
  const label = check
    ? [name, check.waiter?.name, t("tables.elapsed", { minutes: minutesSince(check.opened_at) })].filter(Boolean).join(", ")
    : `${name}, ${t("tables.free")}`;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={ready > 0 ? `${label}, ${t("tables.counts", { ready, preparing: check?.counts.preparing ?? 0 })}` : label}
      style={{
        flex: 1,
        minHeight: 104,
        justifyContent: "space-between",
        backgroundColor: check ? c.surface : c.surfaceAlt,
        borderColor: check?.mine ? c.primary : c.line,
        borderWidth: check?.mine ? 2 : 1,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <AppText variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
          {name}
        </AppText>
        {ready > 0 ? (
          <View style={{ minWidth: 28, height: 28, borderRadius: 14, backgroundColor: c.ok, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
            <AppText variant="label" style={{ color: c.onPrimary, letterSpacing: 0 }}>
              {ready}
            </AppText>
          </View>
        ) : null}
      </View>
      {check ? (
        <View style={{ gap: 2 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {check.waiter?.name ?? ""}
          </AppText>
          <AppText variant="label" tone="muted">
            {t("tables.elapsed", { minutes: minutesSince(check.opened_at) })}
            {check.mine ? ` · ${t("tables.mine")}` : ""}
          </AppText>
        </View>
      ) : (
        <View style={{ alignSelf: "flex-start", borderRadius: radius.chip, borderWidth: 1, borderColor: c.line, paddingHorizontal: space[2], paddingVertical: 2 }}>
          <AppText variant="label" tone="muted">
            {t("tables.free").toUpperCase()}
          </AppText>
        </View>
      )}
    </Card>
  );
}
