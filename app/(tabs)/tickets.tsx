import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { listTickets } from "@/api/tickets";
import type { Ticket, TicketStatus } from "@/api/types";
import { EmptyState } from "@/components/empty-state";
import { ErrorView } from "@/components/error-view";
import { EmptyTicketsArt } from "@/components/illustrations";
import { SkeletonBlock } from "@/components/skeleton";
import { AppText, Card, Chip, Field } from "@/components/ui";
import { useKeys } from "@/hooks/use-orders";
import { formatMoney } from "@/lib/money";
import { t, useLocale } from "@/i18n";
import { rowEnter, space, TAB_BAR_HEIGHT, useTheme } from "@/theme";

const STATUSES: TicketStatus[] = ["pending", "paid", "voided"];

export default function TicketsList() {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const keys = useKeys();
  const [status, setStatus] = useState<TicketStatus | undefined>();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const filters = { status, search: debounced || undefined };

  const query = useInfiniteQuery({
    queryKey: keys.tickets(filters),
    queryFn: ({ pageParam }) => listTickets({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.info.page_end < last.info.total ? last.info.page_index + 1 : undefined),
  });
  const tickets: Ticket[] = query.data?.pages.flatMap((page) => page.results) ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: space[4], gap: space[3], paddingBottom: space[3] }}>
        <Field label={t("tickets.search")} icon="search" value={search} onChangeText={setSearch} autoCapitalize="characters" autoCorrect={false} testID="tickets-search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
          {[undefined, ...STATUSES].map((value) => (
            <Chip key={value ?? "all"} label={value ? t(`ticket.status.${value}`) : t("tickets.filterAll")} selected={status === value} onPress={() => setStatus(value)} />
          ))}
        </ScrollView>
      </View>

      {query.isError && tickets.length === 0 ? (
        <ErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <View style={{ padding: space[4], gap: space[3] }}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} height={84} style={{ borderRadius: 16 }} />
          ))}
        </View>
      ) : (
        <Animated.FlatList
          data={tickets}
          keyExtractor={(ticket) => String(ticket.id)}
          contentContainerStyle={{ padding: space[4], gap: space[3], flexGrow: 1, paddingBottom: TAB_BAR_HEIGHT + space[8] }}
          refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} tintColor={c.primary} colors={[c.primary]} />}
          onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()}
          ListEmptyComponent={<EmptyState art={<EmptyTicketsArt />} title={t("tickets.empty")} body={t("tickets.emptyBody")} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={rowEnter(index)}>
              <Card onPress={() => router.push(`/ticket/${item.id}` as never)} accessibilityLabel={`${item.folio}, ${t(`ticket.status.${item.status}`)}, ${formatMoney(item.total)}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <AppText variant="title">{item.folio}</AppText>
                  <AppText variant="figure">{formatMoney(item.total)}</AppText>
                </View>
                <AppText tone="muted">
                  {item.work_order?.title ?? ""} · {t(`ticket.status.${item.status}`)}
                </AppText>
              </Card>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}
