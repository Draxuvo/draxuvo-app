import { useIsFocused, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { RefreshControl, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated from "react-native-reanimated";
import type { CheckSummary, WorkOrder } from "@/api/types";
import { CheckCard } from "@/components/check-card";
import { EmptyState } from "@/components/empty-state";
import { ErrorView } from "@/components/error-view";
import { Fab } from "@/components/fab";
import { EmptyOrdersArt } from "@/components/illustrations";
import { OrderCard } from "@/components/order-card";
import { OrderFilters, type OrderFilterValue } from "@/components/order-filters";
import { OrderStatusTabs, type StatusTab } from "@/components/order-status-tabs";
import { OrderListSkeleton } from "@/components/skeleton";
import { AppText } from "@/components/ui";
import { useScreenModeState } from "@/components/take-order/use-screen-mode";
import { useTables } from "@/hooks/use-restaurant";
import { todayISO, useEmployees, useOrderCounts, useOrders } from "@/hooks/use-orders";
import { t, useLocale } from "@/i18n";
import { isBossRole, useSession } from "@/session";
import { rowEnter, space, useTheme } from "@/theme";

/** Mientras Órdenes está a la vista se vuelve a consultar cada 10 s. */
const ORDERS_POLL_MS = 10_000;

type Row =
  | { kind: "check"; key: string; name: string; takeout: boolean; check: CheckSummary }
  | { kind: "order"; key: string; order: WorkOrder };

/**
 * Órdenes y Mesas en una sola pestaña (spec 023): pestañas de estado con contador (Pendientes, En curso, Terminadas,
 * Cobradas), Canceladas como filtro aparte y, con mesas, las cuentas abiertas dentro de En curso junto a las órdenes.
 * El botón de nueva orden abre Tomar pedido o el formulario según el modo de la empresa.
 */
export default function OrdersList() {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const { role, user } = useSession();
  const boss = isBossRole(role);
  const [tab, setTab] = useState<StatusTab | null>(null);
  const [filters, setFilters] = useState<OrderFilterValue>({});
  const [extended, setExtended] = useState(true);

  const { mode, ready } = useScreenModeState();
  const restaurant = mode === "restaurant";
  const tables = useTables();
  // Con mesas se abre en En curso, donde viven las cuentas; sin ellas, en Pendientes.
  const selected: StatusTab = tab ?? (restaurant ? "in_progress" : "open");
  const status = filters.cancelled ? "cancelled" : selected;
  const newOrder = () => router.push((mode === "none" ? "/orden-form/nueva" : "/pedido") as never);

  // La lista se actualiza sola mientras está a la vista; fuera de ella no consulta (spec 021).
  const focused = useIsFocused();
  const poll = focused ? ORDERS_POLL_MS : undefined;
  const common = { employee_id: boss ? filters.employeeId : undefined };
  const list = useOrders({ ...common, status, ...(status === "paid" ? { paid_on: todayISO() } : {}) }, true, poll);
  const counts = useOrderCounts(common, poll);
  const employees = useEmployees(boss);

  // Cuentas abiertas: quien opera ve solo las que atiende; la administración, todas.
  const checkRows = useMemo<Row[]>(() => {
    if (!restaurant || !tables.data) return [];
    const open = [
      ...tables.data.results.flatMap((table) => (table.check ? [{ key: `table-${table.id}`, name: table.name, takeout: false, check: table.check }] : [])),
      ...tables.data.takeouts.map((check) => ({ key: `takeout-${check.id}`, name: check.takeout_name, takeout: true, check })),
    ];
    return open.filter((item) => boss || item.check.mine).map((item) => ({ kind: "check" as const, ...item }));
  }, [restaurant, tables.data, boss]);
  const showChecks = !filters.cancelled && selected === "in_progress";

  const orders = useMemo<WorkOrder[]>(() => list.data?.pages.flatMap((page) => page.results) ?? [], [list.data]);
  const rows: Row[] = [
    ...(showChecks ? checkRows : []),
    ...orders.map((order) => ({ kind: "order" as const, key: `order-${order.id}`, order })),
  ];

  const tabCounts = { ...counts, in_progress: counts.in_progress + checkRows.length };
  const loading = list.isLoading;
  const error = list.error;
  const refreshing = list.isRefetching && !list.isFetchingNextPage;
  const refresh = () => {
    void list.refetch();
    void tables.refetch();
  };
  const loadMore = () => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage();

  const lastY = useRef(0);
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    setExtended(y < 24 || y < lastY.current);
    lastY.current = y;
  };

  const firstName = user?.first_name ?? "";
  const pending = counts.open + tabCounts.in_progress;
  const showEmpty = !loading && !error && rows.length === 0;
  const alerts = restaurant && boss ? tables.data?.stock_alerts ?? 0 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: space[4], paddingBottom: space[3], gap: space[3] }}>
        <AppText tone="muted" accessibilityLiveRegion="polite">
          {firstName ? `${t("orders.hello", { name: firstName })} ` : ""}
          {pending > 0 ? t("orders.pendingToday", { count: pending }) : ""}
        </AppText>
        {alerts > 0 ? (
          <AppText tone="stamp" variant="bodyStrong" accessibilityRole="alert" testID="stock-alerts">
            {t("takeOrder.stockAlerts", { count: alerts })}
          </AppText>
        ) : null}
      </View>
      <OrderStatusTabs
        value={filters.cancelled ? null : selected}
        onChange={(next) => {
          setTab(next);
          setFilters((current) => ({ ...current, cancelled: false }));
        }}
        counts={tabCounts}
        cancelled={!!filters.cancelled}
        onToggleCancelled={() => setFilters((current) => ({ ...current, cancelled: !current.cancelled }))}
      />
      <OrderFilters value={filters} onChange={setFilters} employees={boss ? employees.data?.results : undefined} />

      {error && rows.length === 0 ? (
        <ErrorView error={error} onRetry={refresh} />
      ) : (loading || (restaurant === false && !ready)) && rows.length === 0 ? (
        <OrderListSkeleton />
      ) : (
        <Animated.FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={{ padding: space[4], gap: space[3], flexGrow: 1, paddingBottom: 96 }}
          renderItem={({ item, index }) => (
            <Animated.View entering={rowEnter(index)}>
              {item.kind === "check" ? (
                <CheckCard name={item.name} takeout={item.takeout} check={item.check} onPress={() => router.push(`/pedido?cuenta=${item.check.id}` as never)} />
              ) : (
                <OrderCard order={item.order} onPress={() => router.push(`/ordenes/${item.order.id}` as never)} />
              )}
            </Animated.View>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary} colors={[c.primary]} />}
          onEndReached={loadMore}
          onScroll={onScroll}
          scrollEventThrottle={32}
          ListEmptyComponent={
            showEmpty ? (
              <EmptyState testID="orders-empty" art={<EmptyOrdersArt />} title={t(`orders.empty.${status}.title`)} body={t(`orders.empty.${status}.body`)} />
            ) : null
          }
          ListHeaderComponent={error ? <ErrorView error={error} onRetry={refresh} /> : null}
        />
      )}

      <Fab icon="plus" label={restaurant ? t("orders.newCheck") : t("orders.new")} extended={extended} onPress={newOrder} />
    </View>
  );
}
