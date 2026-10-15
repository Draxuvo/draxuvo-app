import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated from "react-native-reanimated";
import type { WorkOrder, WorkOrderStatus } from "@/api/types";
import { EmptyState } from "@/components/empty-state";
import { ErrorView } from "@/components/error-view";
import { Fab } from "@/components/fab";
import { EmptyOrdersArt } from "@/components/illustrations";
import { OrderCard } from "@/components/order-card";
import { OrderFilters, type OrderFilterValue } from "@/components/order-filters";
import { OrderListSkeleton } from "@/components/skeleton";
import { AppText, Segmented } from "@/components/ui";
import { useEmployees, useOrders } from "@/hooks/use-orders";
import { t, useLocale } from "@/i18n";
import { isBossRole, useSession } from "@/session";
import { rowEnter, space, TAB_BAR_HEIGHT, useTheme } from "@/theme";

type Segment = "toDo" | "finished";
const SEGMENT_STATUSES: Record<Segment, WorkOrderStatus[]> = {
  toDo: ["in_progress", "open"],
  finished: ["done", "paid"],
};

export default function OrdersList() {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const { role, user } = useSession();
  const boss = isBossRole(role);
  const [segment, setSegment] = useState<Segment>("toDo");
  const [filters, setFilters] = useState<OrderFilterValue>({});
  const [extended, setExtended] = useState(true);

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

  const toDoCount = [inProgress, open].reduce((sum, q) => sum + (q.data?.pages[0]?.info.total ?? 0), 0);
  const lastY = useRef(0);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    setExtended(y < 24 || y < lastY.current);
    lastY.current = y;
  };

  const firstName = user?.first_name ?? "";
  const showEmpty = !loading && !error && orders.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: space[4], paddingBottom: space[3], gap: space[3] }}>
        <AppText tone="muted" accessibilityLiveRegion="polite">
          {firstName ? `${t("orders.hello", { name: firstName })} ` : ""}
          {toDoCount > 0 ? t("orders.pendingToday", { count: toDoCount }) : ""}
        </AppText>
        <Segmented
          value={filters.status ? null : segment}
          onChange={(value) => {
            setSegment(value);
            setFilters((current) => ({ ...current, status: undefined }));
          }}
          options={[
            { value: "toDo", label: t("orders.toDo"), count: toDoCount },
            { value: "finished", label: t("orders.finished") },
          ]}
        />
      </View>
      {boss ? <OrderFilters value={filters} onChange={setFilters} employees={employees.data?.results} /> : null}

      {error && orders.length === 0 ? (
        <ErrorView error={error} onRetry={refresh} />
      ) : loading && orders.length === 0 ? (
        <OrderListSkeleton />
      ) : (
        <Animated.FlatList
          data={orders}
          keyExtractor={(order) => String(order.id)}
          contentContainerStyle={{ padding: space[4], gap: space[3], flexGrow: 1, paddingBottom: TAB_BAR_HEIGHT + 120 }}
          renderItem={({ item, index }) => (
            <Animated.View entering={rowEnter(index)}>
              <OrderCard order={item} onPress={() => router.push(`/ordenes/${item.id}` as never)} />
            </Animated.View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
          onEndReached={loadMore}
          onScroll={onScroll}
          scrollEventThrottle={32}
          ListEmptyComponent={
            showEmpty ? (
              <EmptyState
                testID="orders-empty"
                art={<EmptyOrdersArt />}
                title={t(!filters.status && segment === "finished" ? "orders.emptyFinished" : "orders.emptyToDo")}
                body={t(!filters.status && segment === "finished" ? "orders.emptyFinishedBody" : "orders.emptyToDoBody")}
              />
            ) : null
          }
          ListHeaderComponent={error ? <ErrorView error={error} onRetry={refresh} /> : null}
        />
      )}

      {boss ? <Fab icon="plus" label={t("orders.new")} extended={extended} onPress={() => router.push("/orden-form/nueva" as never)} /> : null}
    </View>
  );
}
