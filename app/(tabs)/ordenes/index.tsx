import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import type { WorkOrder, WorkOrderStatus } from "@/api/types";
import { ErrorView } from "@/components/error-view";
import { OrderCard } from "@/components/order-card";
import { OrderFilters, type OrderFilterValue } from "@/components/order-filters";
import { AppText } from "@/components/ui";
import { useEmployees, useOrders } from "@/hooks/use-orders";
import { t, useLocale } from "@/i18n";
import { isBossRole, useSession } from "@/session";
import { colors, MIN_TOUCH, radii, spacing } from "@/theme";

type Segment = "toDo" | "finished";
const SEGMENT_STATUSES: Record<Segment, WorkOrderStatus[]> = {
  toDo: ["in_progress", "open"],
  finished: ["done", "paid"],
};

export default function OrdersList() {
  useLocale();
  const router = useRouter();
  const { role } = useSession();
  const boss = isBossRole(role);
  const [segment, setSegment] = useState<Segment>("toDo");
  const [filters, setFilters] = useState<OrderFilterValue>({});

  // Con un estado elegido en los filtros manda ese; si no, el segmento. La API acepta un estado por llamada.
  const statuses = filters.status ? [filters.status] : SEGMENT_STATUSES[segment];
  const common = { employee_id: boss ? filters.employeeId : undefined };
  const inProgress = useOrders({ ...common, status: "in_progress" }, statuses.includes("in_progress"));
  const open = useOrders({ ...common, status: "open" }, statuses.includes("open"));
  const done = useOrders({ ...common, status: "done" }, statuses.includes("done"));
  const paid = useOrders({ ...common, status: "paid" }, statuses.includes("paid"));
  const cancelled = useOrders({ ...common, status: "cancelled" }, statuses.includes("cancelled"));
  const employees = useEmployees(boss);

  const byStatus: Record<WorkOrderStatus, typeof open> = { in_progress: inProgress, open, done, paid, cancelled };
  const active = statuses.map((status) => byStatus[status]);

  const orders = useMemo<WorkOrder[]>(
    () => active.flatMap((query) => query.data?.pages.flatMap((page) => page.results) ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inProgress.data, open.data, done.data, paid.data, cancelled.data, filters.status, segment],
  );

  const loading = active.some((query) => query.isLoading);
  const error = active.find((query) => query.isError)?.error;
  const refreshing = active.some((query) => query.isRefetching && !query.isFetchingNextPage);
  const refresh = () => active.forEach((query) => void query.refetch());
  const loadMore = () => active.forEach((query) => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage());

  return (
    <View style={{ flex: 1, backgroundColor: colors.anaquel }}>
      <View style={styles.segments}>
        {(["toDo", "finished"] as Segment[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: !filters.status && segment === value }}
            onPress={() => {
              setSegment(value);
              setFilters((current) => ({ ...current, status: undefined }));
            }}
            style={[styles.segment, !filters.status && segment === value && styles.segmentOn]}
          >
            <AppText variant="bodyStrong" style={{ color: !filters.status && segment === value ? colors.etiqueta : colors.tinta }}>
              {t(value === "toDo" ? "orders.toDo" : "orders.finished")}
            </AppText>
          </Pressable>
        ))}
      </View>

      {boss ? <OrderFilters value={filters} onChange={setFilters} employees={employees.data?.results} /> : null}

      {error && orders.length === 0 ? (
        <ErrorView error={error} onRetry={refresh} />
      ) : loading && orders.length === 0 ? (
        <ActivityIndicator color={colors.tinta} style={{ marginTop: spacing[8] }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(order) => String(order.id)}
          contentContainerStyle={{ padding: spacing[4], gap: spacing[3], flexGrow: 1 }}
          renderItem={({ item }) => <OrderCard order={item} onPress={() => router.push(`/ordenes/${item.id}` as never)} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          onEndReached={loadMore}
          ListEmptyComponent={
            <View style={{ padding: spacing[6] }}>
              <AppText muted testID="orders-empty">
                {t(!filters.status && segment === "finished" ? "orders.emptyFinished" : "orders.emptyToDo")}
              </AppText>
            </View>
          }
          ListHeaderComponent={error ? <ErrorView error={error} onRetry={refresh} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: "row", gap: spacing[2], padding: spacing[4] },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.etiqueta,
    borderWidth: 1.5,
    borderColor: colors.tinta,
    backgroundColor: colors.etiqueta,
  },
  segmentOn: { backgroundColor: colors.tinta },
});
