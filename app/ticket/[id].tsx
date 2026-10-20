import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { getSubscription, getTicket } from "@/api/tickets";
import type { Ticket } from "@/api/types";
import { ErrorView } from "@/components/error-view";
import { SkeletonBlock } from "@/components/skeleton";
import { TicketActions } from "@/components/ticket-actions";
import { AppText, Button } from "@/components/ui";
import { useKeys } from "@/hooks/use-orders";
import { haptic } from "@/lib/haptics";
import { formatMoney } from "@/lib/money";
import { t, useLocale } from "@/i18n";
import { radius, rowEnter, space, useTheme } from "@/theme";

/** Borde de recibo: dientes de sierra abajo, del color del fondo. */
function Zigzag({ color, width = 360 }: { color: string; width?: number }) {
  const teeth = Math.ceil(width / 16);
  let d = `M0 0 H${teeth * 16} V0`;
  for (let i = teeth; i > 0; i--) d += ` L${i * 16 - 8} 10 L${(i - 1) * 16} 0`;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Svg width="100%" height={10} viewBox={`0 0 ${teeth * 16} 10`} preserveAspectRatio="none">
      <Path d={d + " Z"} fill={color} />
    </Svg>
    </View>
  );
}

/** Sello de cobrado que cae sobre el recibo. */
function PaidStamp() {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const drop = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    drop.set(withDelay(350, withSequence(withTiming(1.15, { duration: 160, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 180 }))));
    const timer = setTimeout(() => haptic.success(), 520);
    return () => clearTimeout(timer);
  }, [drop, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: drop.value === 0 ? 0 : 0.95, transform: [{ rotate: "-9deg" }, { scale: drop.value === 0 ? 2.4 : drop.value }] }));
  return (
    <Animated.View style={[{ position: "absolute", right: space[4], top: space[6], borderWidth: 3, borderColor: c.ok, borderRadius: 8, paddingHorizontal: space[3], paddingVertical: space[1] }, style]}>
      <AppText variant="title" tone="ok" style={{ letterSpacing: 2 }}>
        {t("charge.done").toUpperCase()}
      </AppText>
    </Animated.View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
      <AppText tone="muted">{label}</AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

export default function TicketScreen() {
  useLocale();
  const { c } = useTheme();
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

  const header = <Stack.Screen options={{ title: t("ticket.title") }} />;
  if (ticket.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, padding: space[4], gap: space[3] }}>
        {header}
        <SkeletonBlock height={260} />
      </View>
    );
  }
  if (ticket.isError || !ticket.data) return <ErrorView error={ticket.error} onRetry={() => void ticket.refetch()} />;

  const data: Ticket = ticket.data;
  // Los pagos anulados se quedan en la historia de la orden (spec 015).
  const activePayments = (data.payments ?? []).filter((payment) => !payment.voided_at);
  const canWhatsapp = !!subscription.data?.active_modules.includes("whatsapp");

  return (
    <Animated.ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space[4], gap: space[5] }}>
      {header}
      <Animated.View entering={rowEnter(0)}>
        <View style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderWidth: 1, borderBottomWidth: 0, borderColor: c.line, padding: space[5], gap: space[4] }}>
          <View style={{ gap: space[1] }}>
            <AppText variant="label" tone="muted">
              {t("ticket.folio").toUpperCase()}
            </AppText>
            <AppText variant="display" testID="ticket-folio">
              {data.folio}
            </AppText>
            <AppText tone="muted">{t(`ticket.status.${data.status}`)}</AppText>
            {data.check ? (
              <AppText variant="bodyStrong" testID="ticket-check">
                {data.check.table ? t("ticket.table", { name: data.check.table }) : t("ticket.takeout", { name: data.check.takeout_name ?? "" })}
              </AppText>
            ) : null}
          </View>
          <View style={{ borderTopWidth: 1.5, borderTopColor: c.line, borderStyle: "dashed", paddingTop: space[4], gap: space[1] }}>
            <AppText variant="label" tone="muted">
              {t("ticket.total").toUpperCase()}
            </AppText>
            <AppText variant="figureLarge">{formatMoney(data.total)}</AppText>
          </View>
          {activePayments.length > 0 ? (
            <View style={{ borderTopWidth: 1.5, borderTopColor: c.line, borderStyle: "dashed", paddingTop: space[4], gap: space[2] }}>
              <AppText variant="label" tone="muted">
                {t("ticket.payments").toUpperCase()}
              </AppText>
              {activePayments.map((payment, index) => (
                <Row
                  key={payment.id ?? index}
                  label={[
                    t(`charge.methods.${payment.method}`),
                    payment.terminal?.name,
                    payment.authorization_code ? `${t("charge.authorization")} ${payment.authorization_code}` : null,
                    payment.card_last4 ? `•••• ${payment.card_last4}` : null,
                    payment.reference ? t("ticket.reference", { reference: payment.reference }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  value={formatMoney(payment.amount)}
                />
              ))}
              {data.change_given && Number(data.change_given) > 0 ? <AppText>{`${t("ticket.change")}: ${formatMoney(data.change_given)}`}</AppText> : null}
            </View>
          ) : data.payment_method || data.amount_received != null || data.change_given ? (
            <View style={{ borderTopWidth: 1.5, borderTopColor: c.line, borderStyle: "dashed", paddingTop: space[4], gap: space[2] }}>
              {data.payment_method ? <Row label={t("ticket.method")} value={t(`charge.methods.${data.payment_method}`)} /> : null}
              {data.amount_received != null ? <AppText>{`${t("ticket.received")}: ${formatMoney(data.amount_received)}`}</AppText> : null}
              {data.change_given ? <AppText>{`${t("ticket.change")}: ${formatMoney(data.change_given)}`}</AppText> : null}
            </View>
          ) : null}
          {data.status === "paid" ? <PaidStamp /> : null}
        </View>
        <Zigzag color={c.surface} />
      </Animated.View>
      <Animated.View entering={rowEnter(2)} style={{ gap: space[3] }}>
        <TicketActions ticket={data} canWhatsapp={canWhatsapp && !data.check} />
        <Button
          label={data.check ? t("ticket.backToTables") : t("ticket.backToOrders")}
          variant="text"
          onPress={() => router.replace(data.check ? "/(tabs)/mesas" : "/(tabs)/ordenes")}
        />
      </Animated.View>
    </Animated.ScrollView>
  );
}
