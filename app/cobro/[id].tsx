import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ApiError } from "@/api/client";
import { chargeOrder, type ChargeBody } from "@/api/orders";
import { ChargeForm } from "@/components/charge-form";
import { describeError, ErrorView } from "@/components/error-view";
import { SkeletonBlock } from "@/components/skeleton";
import { AppText } from "@/components/ui";
import { useApplyOrder, useOrder } from "@/hooks/use-orders";
import { haptic } from "@/lib/haptics";
import { t, useLocale } from "@/i18n";
import { rowEnter, space, useTheme } from "@/theme";

export default function Cobro() {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const query = useOrder(orderId);
  const apply = useApplyOrder();
  const [error, setError] = useState<string | null>(null);

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, padding: space[4], gap: space[4] }}>
        <Stack.Screen options={{ title: t("charge.title") }} />
        <SkeletonBlock width="50%" height={52} />
        <SkeletonBlock height={90} />
        <SkeletonBlock height={140} />
      </View>
    );
  }
  if (query.isError || !query.data) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;

  const order = query.data;
  const total = Number(order.total ?? 0);
  const blocked = order.charge_blocked_reason === "no_items" || !(order.allowed_actions ?? []).includes("charge");

  const submit = async (body: ChargeBody) => {
    setError(null);
    try {
      const charged = await chargeOrder(orderId, body);
      haptic.success();
      apply(charged);
      if (charged.ticket) router.replace(`/ticket/${charged.ticket.id}` as never);
      else router.back();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 422) void query.refetch();
      haptic.warning();
      setError(describeError(failure));
    }
  };

  return (
    <Animated.ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space[4], gap: space[4] }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t("charge.title") }} />
      <Animated.View entering={rowEnter(0)}>
        <AppText variant="headline">{order.title}</AppText>
      </Animated.View>
      <Animated.View entering={rowEnter(1)}>
        <ChargeForm total={total} blocked={blocked} onSubmit={submit} />
      </Animated.View>
      {error ? (
        <AppText tone="stamp" accessibilityRole="alert" testID="charge-error">
          {error}
        </AppText>
      ) : null}
    </Animated.ScrollView>
  );
}
