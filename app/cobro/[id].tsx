import * as Crypto from "expo-crypto";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ApiError } from "@/api/client";
import { chargeOrder, type ChargeBody } from "@/api/orders";
import { useTerminals } from "@/api/terminals";
import { ChargeForm } from "@/components/charge-form";
import { describeError, ErrorView } from "@/components/error-view";
import { SkeletonBlock } from "@/components/skeleton";
import { AppText, KeyboardFrame } from "@/components/ui";
import { useApplyOrder, useOrder } from "@/hooks/use-orders";
import { haptic } from "@/lib/haptics";
import { toast } from "@/toast/store";
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
  const terminals = useTerminals();
  // Una llave por intento de cobro: un reintento tras perder la red no cobra dos veces (FR-012).
  const idempotencyKey = useRef(Crypto.randomUUID());

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
    try {
      const charged = await chargeOrder(orderId, body, idempotencyKey.current);
      haptic.success();
      apply(charged);
      if (charged.ticket) router.replace(`/ticket/${charged.ticket.id}` as never);
      else router.back();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 422) void query.refetch();
      haptic.warning();
      toast.error(describeError(failure));
    }
  };

  return (
    <KeyboardFrame>
<Animated.ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space[4], gap: space[4] }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t("charge.title") }} />
      <Animated.View entering={rowEnter(0)}>
        <AppText variant="headline">{order.title}</AppText>
      </Animated.View>
      <Animated.View entering={rowEnter(1)}>
        <ChargeForm total={total} blocked={blocked} terminals={terminals.data ?? []} onSubmit={submit} />
      </Animated.View>
    </Animated.ScrollView>
</KeyboardFrame>
  );
}
