import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import type { ChargeBody } from "@/api/orders";
import type { PaymentMethod } from "@/api/types";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { changeOrMissing, formatMoney, parseMoney } from "@/lib/money";
import { radius, space, useTheme } from "@/theme";
import { AppText, Button, Chip, Field, Icon, type IconName } from "./ui";

const METHODS: { value: PaymentMethod; icon: IconName }[] = [
  { value: "cash", icon: "dollar-sign" },
  { value: "card", icon: "credit-card" },
  { value: "transfer", icon: "repeat" },
];

/** Billetes redondos por encima del total: atajos para no teclear el monto recibido. */
function quickAmounts(total: number): number[] {
  const bills = [50, 100, 200, 500, 1000];
  const next = bills.filter((bill) => bill >= total).slice(0, 3);
  return next.length ? next : [Math.ceil(total / 100) * 100];
}

/**
 * Formulario de cobro. El botón se bloquea al pulsar y no vuelve hasta recibir respuesta, así un
 * doble toque cobra una sola vez (FR-011, SC-010).
 */
export function ChargeForm({
  total,
  blocked,
  onSubmit,
}: {
  total: number;
  /** La orden no tiene conceptos con precio. */
  blocked: boolean;
  onSubmit: (body: ChargeBody) => Promise<void>;
}) {
  const { c } = useTheme();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const amount = parseMoney(received);
  const diff = method === "cash" && amount != null ? changeOrMissing(total, amount) : null;

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const fail = (message: string) => {
    haptic.warning();
    setError(message);
    shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 80 }), withTiming(0, { duration: 60 })));
  };

  const submit = async () => {
    if (inFlight.current) return;
    if (method === "cash") {
      if (amount == null) return fail(t("charge.invalidAmount"));
      if (amount < total) return fail(t("charge.insufficient"));
    }
    setError(null);
    inFlight.current = true;
    setBusy(true);
    try {
      await onSubmit(method === "cash" ? { payment_method: method, amount_received: amount ?? total } : { payment_method: method });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: space[6] }}>
      <View style={{ gap: space[1] }}>
        <AppText variant="label" tone="muted">
          {t("charge.total").toUpperCase()}
        </AppText>
        <AppText variant="figureLarge" testID="charge-total">
          {formatMoney(total)}
        </AppText>
      </View>

      {blocked ? (
        <View accessibilityRole="alert" style={{ backgroundColor: c.stampSoft, borderRadius: radius.field, padding: space[3], flexDirection: "row", gap: space[2], alignItems: "center" }}>
          <Icon name="alert-circle" tone="stamp" />
          <AppText style={{ color: c.onStampSoft, flex: 1 }}>{t("charge.noItems")}</AppText>
        </View>
      ) : null}

      <View style={{ gap: space[2] }}>
        <AppText variant="label" tone="muted">
          {t("charge.method").toUpperCase()}
        </AppText>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          {METHODS.map(({ value, icon }) => {
            const selected = method === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityLabel={t(`charge.methods.${value}`)}
                accessibilityState={{ selected }}
                onPress={() => {
                  haptic.select();
                  setMethod(value);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  minHeight: 84,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: space[2],
                  borderRadius: radius.card,
                  borderWidth: 2,
                  borderColor: selected ? c.primary : c.line,
                  backgroundColor: selected ? c.primarySoft : c.surface,
                }}
              >
                <Icon name={icon} tone={selected ? "primary" : "muted"} size={26} />
                <AppText variant="bodyStrong" style={{ color: selected ? c.onPrimarySoft : c.ink, fontSize: 13 }}>
                  {t(`charge.methods.${value}`)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {method === "cash" ? (
        <Animated.View style={[{ gap: space[3] }, shakeStyle]}>
          <Field label={t("charge.received")} icon="dollar-sign" value={received} onChangeText={setReceived} keyboardType="decimal-pad" error={error} testID="charge-received" />
          <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
            <Chip label={t("charge.exact")} selected={amount === total} onPress={() => setReceived(String(total))} />
            {quickAmounts(total).map((bill) => (
              <Chip key={bill} label={formatMoney(bill).replace(".00", "")} selected={amount === bill} onPress={() => setReceived(String(bill))} />
            ))}
          </View>
          {diff ? (
            <View style={{ backgroundColor: diff.missing > 0 ? c.stampSoft : c.marker, borderRadius: radius.field, padding: space[4] }}>
              <AppText variant="figure" testID="charge-diff" style={{ color: diff.missing > 0 ? c.onStampSoft : c.onMarker }}>
                {diff.missing > 0 ? `${t("charge.missing")}: ${formatMoney(diff.missing)}` : `${t("charge.change")}: ${formatMoney(diff.change)}`}
              </AppText>
            </View>
          ) : null}
        </Animated.View>
      ) : error ? (
        <AppText tone="stamp">{error}</AppText>
      ) : null}

      <Button label={t("charge.submit", { total: formatMoney(total) })} icon="check" onPress={() => void submit()} loading={busy} disabled={blocked || busy} />
    </View>
  );
}
