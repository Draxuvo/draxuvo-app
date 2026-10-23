import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { RefreshControl, View } from "react-native";
import Animated from "react-native-reanimated";
import { getRoster, type RosterRow } from "@/api/attendance";
import { TeamMarkModal, type TeamMarkTarget } from "@/components/attendance/team-mark-modal";
import { EmptyState } from "@/components/empty-state";
import { ErrorView } from "@/components/error-view";
import { AppText, Button, Card } from "@/components/ui";
import { t, useLocale } from "@/i18n";
import { shortTime } from "@/lib/time";
import { useSession } from "@/session";
import { rowEnter, space, useTheme } from "@/theme";

/** Lista del día por empleado para marcar entrada y salida de otros (spec 036); solo administrador y dueño. */
export default function AsistenciaEquipo() {
  useLocale();
  const { c } = useTheme();
  const { companyId, role } = useSession();
  const [target, setTarget] = useState<TeamMarkTarget | null>(null);
  const allowed = role === "admin" || role === "owner";
  const query = useQuery({ queryKey: ["roster", companyId], queryFn: getRoster, enabled: allowed && companyId != null, retry: false });
  const rows = query.data?.results ?? [];

  if (!allowed) return null;

  return (
    <>
      <Stack.Screen options={{ title: t("teamAttendance.title") }} />
      {query.isError ? (
        <ErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <Animated.FlatList
          style={{ backgroundColor: c.background }}
          contentContainerStyle={{ padding: space[4], gap: space[3] }}
          data={rows}
          keyExtractor={(row: RosterRow) => String(row.employee.id)}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.primary} colors={[c.primary]} />}
          ListEmptyComponent={query.isLoading ? null : <EmptyState art={null} title={t("teamAttendance.empty")} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={rowEnter(index)}>
              <TeamRow row={item} onMark={(kind) => setTarget({ employeeId: item.employee.id, name: item.employee.name, kind })} />
            </Animated.View>
          )}
        />
      )}
      <TeamMarkModal target={target} onClose={() => setTarget(null)} />
    </>
  );
}

function TeamRow({ row, onMark }: { row: RosterRow; onMark: (kind: "in" | "out") => void }) {
  const a = row.attendance;
  const detail =
    row.state === "working" && a
      ? t("teamAttendance.workingSince", { time: shortTime(a.checkin_at) })
      : row.state === "done" && a?.checkout_at
        ? t("teamAttendance.doneRange", { from: shortTime(a.checkin_at), to: shortTime(a.checkout_at) })
        : t("teamAttendance.noEntry");
  const by = a && (a.checkin_captured || a.checkout_captured) ? (a.checkout_by ?? a.checkin_by) : null;

  return (
    <Card style={{ gap: space[3] }}>
      <View style={{ gap: space[1] }}>
        <AppText variant="bodyStrong">{row.employee.name}</AppText>
        <AppText tone="muted">{`${t(`teamAttendance.state.${row.state}`)} · ${detail}`}</AppText>
        {by ? <AppText tone="muted">{t("teamAttendance.capturedBy", { name: by.name })}</AppText> : null}
      </View>
      {row.state === "working" ? (
        <Button label={t("teamAttendance.markOut")} variant="primary" onPress={() => onMark("out")} />
      ) : (
        <Button label={t("teamAttendance.markIn")} variant="outline" onPress={() => onMark("in")} />
      )}
    </Card>
  );
}
