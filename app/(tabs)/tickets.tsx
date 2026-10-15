import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { listTickets } from "@/api/tickets";
import type { Ticket, TicketStatus } from "@/api/types";
import { ErrorView } from "@/components/error-view";
import { AppText, Card, Field } from "@/components/ui";
import { useKeys } from "@/hooks/use-orders";
import { t, useLocale } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { colors, MIN_TOUCH, radii, spacing } from "@/theme";

const STATUSES: TicketStatus[] = ["pending", "paid", "voided"];

export default function TicketsList() {
  useLocale();
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
    <View style={{ flex: 1, backgroundColor: colors.anaquel }}>
      <View style={{ padding: spacing[4], gap: spacing[3] }}>
        <Field label={t("tickets.search")} value={search} onChangeText={setSearch} autoCapitalize="characters" autoCorrect={false} testID="tickets-search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
          {[undefined, ...STATUSES].map((value) => {
            const selected = status === value;
            const label = value ? t(`ticket.status.${value}`) : t("tickets.filterAll");
            return (
              <Pressable
                key={value ?? "all"}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => setStatus(value)}
                style={{
                  minHeight: MIN_TOUCH,
                  justifyContent: "center",
                  paddingHorizontal: spacing[4],
                  borderRadius: radii.pastilla,
                  borderWidth: 1.5,
                  borderColor: selected ? colors.tinta : colors.anaquelBorde,
                  backgroundColor: selected ? colors.tinta : colors.etiqueta,
                }}
              >
                <AppText variant="bodyStrong" style={{ color: selected ? colors.etiqueta : colors.tinta }}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {query.isError && tickets.length === 0 ? (
        <ErrorView error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <ActivityIndicator color={colors.tinta} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(ticket) => String(ticket.id)}
          contentContainerStyle={{ padding: spacing[4], gap: spacing[3], flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => void query.refetch()} />}
          onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()}
          ListEmptyComponent={<AppText muted>{t("tickets.empty")}</AppText>}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/ticket/${item.id}` as never)} accessibilityLabel={`${item.folio}, ${t(`ticket.status.${item.status}`)}, ${formatMoney(item.total)}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText variant="title">{item.folio}</AppText>
                <AppText variant="bodyStrong">{formatMoney(item.total)}</AppText>
              </View>
              <AppText muted>
                {item.work_order?.title ?? ""} · {t(`ticket.status.${item.status}`)}
              </AppText>
            </Card>
          )}
        />
      )}
    </View>
  );
}
