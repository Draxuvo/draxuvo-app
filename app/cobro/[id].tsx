import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { ApiError } from "@/api/client";
import { chargeOrder, type ChargeBody } from "@/api/orders";
import { ChargeForm } from "@/components/charge-form";
import { describeError, ErrorView } from "@/components/error-view";
import { AppText } from "@/components/ui";
import { useApplyOrder, useOrder } from "@/hooks/use-orders";
import { t, useLocale } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { colors, spacing } from "@/theme";

export default function Cobro() {
  useLocale();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const query = useOrder(orderId);
  const apply = useApplyOrder();
  const [error, setError] = useState<string | null>(null);

  if (query.isLoading) return <ActivityIndicator color={colors.tinta} style={{ marginTop: spacing[8] }} />;
  if (query.isError || !query.data) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;

  const order = query.data;
  const total = Number(order.total ?? 0);
  const blocked = order.charge_blocked_reason === "no_items" || !(order.allowed_actions ?? []).includes("charge");

  const submit = async (body: ChargeBody) => {
    setError(null);
    try {
      const charged = await chargeOrder(orderId, body);
      apply(charged);
      if (charged.ticket) router.replace(`/ticket/${charged.ticket.id}` as never);
      else router.back();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 422) void query.refetch();
      setError(describeError(failure));
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.anaquel }} contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t("charge.title") }} />
      <AppText variant="headline">{order.title}</AppText>
      <AppText muted>{formatMoney(total)}</AppText>
      <ChargeForm total={total} blocked={blocked} onSubmit={submit} />
      {error ? (
        <AppText style={{ color: colors.alerta }} accessibilityRole="alert" testID="charge-error">
          {error}
        </AppText>
      ) : null}
    </ScrollView>
  );
}
