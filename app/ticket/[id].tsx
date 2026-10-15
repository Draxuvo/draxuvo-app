import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { getSubscription, getTicket } from "@/api/tickets";
import { ErrorView } from "@/components/error-view";
import { TicketActions } from "@/components/ticket-actions";
import { AppText, Button, Card } from "@/components/ui";
import { useKeys } from "@/hooks/use-orders";
import { t, useLocale } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { colors, spacing } from "@/theme";

export default function TicketScreen() {
  useLocale();
  const router = useRouter();
  const keys = useKeys();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = Number(id);
  const ticket = useQuery({ queryKey: keys.ticket(ticketId), queryFn: () => getTicket(ticketId) });
  // WhatsApp solo si el plan lo incluye. Staff recibe 403 aquí: se trata como "sin WhatsApp".
  const subscription = useQuery({
    queryKey: [...keys.all, "subscription"],
    queryFn: getSubscription,
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (ticket.isLoading) return <ActivityIndicator color={colors.tinta} style={{ marginTop: spacing[8] }} />;
  if (ticket.isError || !ticket.data) return <ErrorView error={ticket.error} onRetry={() => void ticket.refetch()} />;

  const data = ticket.data;
  const canWhatsapp = !!subscription.data?.active_modules.includes("whatsapp");

  return (
    <ScrollView style={{ backgroundColor: colors.anaquel }} contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }}>
      <Stack.Screen options={{ title: t("ticket.title") }} />
      <Card>
        <AppText variant="label" muted>
          {t("ticket.folio").toUpperCase()}
        </AppText>
        <AppText variant="headline" testID="ticket-folio">
          {data.folio}
        </AppText>
        <AppText muted>{t(`ticket.status.${data.status}`)}</AppText>
        <View style={{ marginTop: spacing[2] }}>
          <AppText variant="label" muted>
            {t("ticket.total").toUpperCase()}
          </AppText>
          <AppText variant="cifra">{formatMoney(data.total)}</AppText>
        </View>
        {data.payment_method ? (
          <AppText>
            {t("ticket.method")}: {t(`charge.methods.${data.payment_method}`)}
          </AppText>
        ) : null}
        {data.amount_received != null ? (
          <AppText>
            {t("ticket.received")}: {formatMoney(data.amount_received)}
          </AppText>
        ) : null}
        {data.change_given ? (
          <AppText>
            {t("ticket.change")}: {formatMoney(data.change_given)}
          </AppText>
        ) : null}
      </Card>
      <TicketActions ticket={data} canWhatsapp={canWhatsapp} />
      <Button label={t("ticket.backToOrders")} variant="outline" onPress={() => router.replace("/(tabs)/ordenes")} />
    </ScrollView>
  );
}
