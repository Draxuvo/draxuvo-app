import { Stack } from "expo-router";
import { useState } from "react";
import { RefreshControl, View } from "react-native";
import Animated from "react-native-reanimated";
import type { OperationalAlert, SnoozableAlertKind, SnoozeMinutes, SnoozedAlert } from "@/api/types";
import { alertSubjectKey } from "@/api/alerts";
import { AlertRow } from "@/components/alert-row";
import { EmptyState } from "@/components/empty-state";
import { ErrorView } from "@/components/error-view";
import { SnoozeSheet } from "@/components/snooze-sheet";
import { AppText, Button } from "@/components/ui";
import { useAlerts, useCanSeeAlerts, useSnoozeAlert, useUnsnoozeAlert } from "@/hooks/use-alerts";
import { t, useLocale } from "@/i18n";
import { toast } from "@/toast/store";
import { rowEnter, space, useTheme } from "@/theme";

const FIRST_PAGE = 50;
const MAX_PAGE = 100;

/** Alertas operativas del dueño y el administrador (spec 045): lo que se tarda y el stock bajo. */
export default function Alertas() {
  useLocale();
  const { c } = useTheme();
  const allowed = useCanSeeAlerts();
  const [expanded, setExpanded] = useState(false);
  const [picking, setPicking] = useState<OperationalAlert | null>(null);
  const query = useAlerts({ pageSize: expanded ? MAX_PAGE : FIRST_PAGE });
  const snooze = useSnoozeAlert();
  const unsnooze = useUnsnoozeAlert();
  const busy = snooze.isPending || unsnooze.isPending;

  if (!allowed) return null;

  const data = query.data;
  const results = data?.results ?? [];
  const snoozed = data?.snoozed ?? [];
  const hasMore = !!data && data.count > results.length;

  function pick(minutes: SnoozeMinutes) {
    const alert = picking;
    setPicking(null);
    if (!alert) return;
    snooze.mutate(
      { kind: alert.kind as SnoozableAlertKind, subject_key: alertSubjectKey(alert), minutes },
      { onSuccess: () => toast.success(t("alerts.snooze.done")) },
    );
  }

  function restore(alert: SnoozedAlert) {
    unsnooze.mutate(
      { kind: alert.kind as SnoozableAlertKind, subjectKey: alertSubjectKey(alert) },
      { onSuccess: () => toast.success(t("alerts.snooze.undone")) },
    );
  }

  const header = data ? (
    <View style={{ gap: space[2] }}>
      {data.count > 0 ? <AppText tone="muted">{data.count === 1 ? t("alerts.countOne") : t("alerts.countMany", { count: data.count })}</AppText> : null}
    </View>
  ) : null;

  const footer = (
    <View style={{ gap: space[3] }}>
      {hasMore && !expanded ? <Button label={t("alerts.more")} variant="outline" onPress={() => setExpanded(true)} /> : null}
      {hasMore && expanded ? <AppText tone="muted">{t("alerts.capped", { shown: results.length, total: data!.count })}</AppText> : null}
      {snoozed.length > 0 ? (
        <View style={{ gap: space[3] }}>
          <AppText variant="bodyStrong">{t("alerts.snoozedTitle", { count: snoozed.length })}</AppText>
          {snoozed.map((alert) => (
            <AlertRow key={alert.id} alert={alert} busy={busy} onUnsnooze={() => restore(alert)} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: t("alerts.title") }} />
      {query.isError ? (
        <ErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Animated.FlatList
          style={{ backgroundColor: c.background }}
          contentContainerStyle={{ padding: space[4], gap: space[3] }}
          data={results}
          keyExtractor={(alert: OperationalAlert) => alert.id}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.primary} colors={[c.primary]} />}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={query.isLoading || snoozed.length > 0 ? null : <EmptyState art={null} title={t("alerts.empty")} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={rowEnter(index)}>
              <AlertRow alert={item} busy={busy} onSnooze={() => setPicking(item)} />
            </Animated.View>
          )}
        />
      )}
      <SnoozeSheet visible={!!picking} onPick={pick} onClose={() => setPicking(null)} />
    </>
  );
}
