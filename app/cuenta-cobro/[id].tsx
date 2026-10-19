import * as Crypto from "expo-crypto";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert, View } from "react-native";
import Animated from "react-native-reanimated";
import { ApiError, NetworkError } from "@/api/client";
import { addPayment, type PaymentBody } from "@/api/restaurant";
import { describeError, ErrorView } from "@/components/error-view";
import { PaymentForm } from "@/components/payment-form";
import { SkeletonBlock } from "@/components/skeleton";
import { AppText, Divider, KeyboardFrame } from "@/components/ui";
import { useCheck } from "@/hooks/use-restaurant";
import { haptic } from "@/lib/haptics";
import { formatMoney } from "@/lib/money";
import { t, useLocale } from "@/i18n";
import { rowEnter, space, useTheme } from "@/theme";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
      <AppText tone="muted">{label}</AppText>
      <AppText variant={strong ? "title" : "bodyStrong"}>{value}</AppText>
    </View>
  );
}

export default function CuentaCobro() {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const checkId = Number(id);
  const query = useCheck(checkId);
  const [message, setMessage] = useState<string | null>(null);
  // La llave de un cobro se conserva hasta el 2xx: reintentar por mala red nunca cobra dos veces.
  const key = useRef<string | null>(null);

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, padding: space[4], gap: space[4] }}>
        <Stack.Screen options={{ title: t("checkout.title") }} />
        <SkeletonBlock height={110} />
        <SkeletonBlock height={220} />
      </View>
    );
  }
  if (query.isError || !query.data) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;

  const check = query.data;
  const balance = Number(check.balance);

  const submit = async (body: PaymentBody) => {
    setMessage(null);
    key.current ??= Crypto.randomUUID();
    try {
      const result = await addPayment(checkId, body, key.current);
      key.current = null;
      haptic.success();
      void query.refetch();
      if (result.ticket) router.replace(`/ticket/${result.ticket.id}` as never);
    } catch (failure) {
      if (!(failure instanceof NetworkError)) key.current = null;
      haptic.warning();
      if (failure instanceof ApiError && failure.code === "incomplete_items") {
        const pending = Number((failure.details as { pending?: number }).pending ?? 0);
        Alert.alert(t("checkout.incompleteTitle"), t("checkout.incompleteBody", { count: pending }), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("checkout.chargeAnyway"), onPress: () => void submit({ ...body, confirm_incomplete: true }) },
        ]);
        return;
      }
      setMessage(failure instanceof NetworkError ? t("checkout.payError") : describeError(failure));
      if (failure instanceof ApiError) void query.refetch();
    }
  };

  return (
    <KeyboardFrame>
      <Animated.ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space[4], gap: space[4] }} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title: t("checkout.title") }} />
        <Animated.View entering={rowEnter(0)} style={{ gap: space[2] }}>
          <Row label={t("checkout.total")} value={formatMoney(check.total)} />
          <Row label={t("checkout.paid")} value={formatMoney(check.paid)} />
          <Divider />
          <Row label={t("checkout.balance")} value={formatMoney(check.balance)} strong />
        </Animated.View>

        {check.payments.length > 0 ? (
          <Animated.View entering={rowEnter(1)} style={{ gap: space[1] }}>
            <AppText variant="label" tone="muted" accessibilityRole="header">
              {t("checkout.payments").toUpperCase()}
            </AppText>
            {check.payments.map((payment, index) => (
              <Row key={payment.id ?? index} label={`${t(`checkout.methods.${payment.method}`)}${payment.reference ? ` · ${payment.reference}` : ""}`} value={formatMoney(payment.amount)} />
            ))}
          </Animated.View>
        ) : null}

        {balance > 0 && check.status === "open" ? (
          <Animated.View entering={rowEnter(2)}>
            <PaymentForm key={check.payments.length} balance={balance} onSubmit={submit} />
          </Animated.View>
        ) : null}
        {message ? (
          <AppText tone="stamp" accessibilityRole="alert" testID="checkout-error">
            {message}
          </AppText>
        ) : null}
      </Animated.ScrollView>
    </KeyboardFrame>
  );
}
