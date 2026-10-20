import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import type { ChargeBody } from "@/api/orders";
import type { ChargePaymentInput, PaymentMethod, PaymentTerminal } from "@/api/types";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { changeOrMissing, formatMoney, parseMoney } from "@/lib/money";
import { radius, space, useTheme } from "@/theme";
import { TerminalPicker } from "./terminal-picker";
import { AppText, Button, Card, Chip, Field, Icon, type IconName } from "./ui";

const METHODS: { value: PaymentMethod; icon: IconName }[] = [
  { value: "cash", icon: "dollar-sign" },
  { value: "card", icon: "credit-card" },
  { value: "transfer", icon: "repeat" },
];

const MAX_PAYMENTS = 5;

/** Billetes redondos por encima del total: atajos para no teclear el monto recibido. */
function quickAmounts(total: number): number[] {
  const bills = [50, 100, 200, 500, 1000];
  const next = bills.filter((bill) => bill >= total).slice(0, 3);
  return next.length ? next : [Math.ceil(total / 100) * 100];
}

interface Row {
  key: number;
  method: PaymentMethod;
  amount: string;
  received: string;
  terminalId: number | null;
  authorization: string;
  last4: string;
  reference: string;
}

const round = (value: number) => Math.round(value * 100) / 100;
const emptyRow = (key: number, method: PaymentMethod): Row => ({
  key, method, amount: "", received: "", terminalId: null, authorization: "", last4: "", reference: "",
});

/**
 * Formulario de cobro con uno o varios pagos (spec 015). Con un solo pago de tarjeta o transferencia el monto
 * es el total; el efectivo (a lo más uno) cubre lo que falta y da el cambio. El botón se bloquea al pulsar y no
 * vuelve hasta recibir respuesta, así un doble toque cobra una sola vez (FR-011, SC-010).
 */
export function ChargeForm({
  total,
  blocked,
  terminals = [],
  onSubmit,
}: {
  total: number;
  /** La orden no tiene conceptos con precio. */
  blocked: boolean;
  terminals?: PaymentTerminal[];
  onSubmit: (body: ChargeBody) => Promise<void>;
}) {
  const { c } = useTheme();
  const [rows, setRows] = useState<Row[]>([emptyRow(0, "cash")]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const single = rows.length === 1;
  const defaultTerminal = terminals.length === 1 ? terminals[0].id : null;
  const amountOf = (row: Row) => (single ? total : parseMoney(row.amount) ?? 0);
  const nonCash = round(rows.filter((r) => r.method !== "cash").reduce((sum, r) => sum + amountOf(r), 0));
  const cashRow = rows.find((r) => r.method === "cash");
  const cashDue = round(total - nonCash);
  const received = cashRow ? parseMoney(cashRow.received) : null;
  const diff = cashRow && received != null ? changeOrMissing(Math.max(0, cashDue), received) : null;

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const fail = (message: string) => {
    haptic.warning();
    setError(message);
    shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 80 }), withTiming(0, { duration: 60 })));
  };

  const patch = (key: number, changes: Partial<Row>) => {
    setError(null);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...changes } : r)));
  };

  const addRow = () => {
    haptic.select();
    setRows((prev) => {
      const method: PaymentMethod = prev.some((r) => r.method === "cash") ? "card" : "cash";
      const filled = prev.map((r) => (r.method !== "cash" && r.amount === "" ? { ...r, amount: String(total) } : r));
      const covered = round(filled.filter((r) => r.method !== "cash").reduce((sum, r) => sum + (parseMoney(r.amount) ?? 0), 0));
      return [...filled, { ...emptyRow(Date.now(), method), amount: method === "cash" ? "" : String(Math.max(0, round(total - covered))) }];
    });
  };

  // Valida como la API (research R4) para avisar antes de enviar.
  const validate = (): string | null => {
    if (nonCash > total) return t("charge.exceeds");
    for (const row of rows) {
      if (row.method !== "cash" && !single && !(amountOf(row) > 0)) return t("charge.invalidAmount");
      if (row.method === "card" && terminals.length > 0 && (row.terminalId ?? defaultTerminal) == null) return t("charge.terminalRequired");
      if (row.method === "card" && row.last4 !== "" && !/^\d{4}$/.test(row.last4)) return t("charge.invalidLast4");
      if (row.method === "transfer" && !row.reference.trim()) return t("charge.referenceRequired");
    }
    if (cashRow) {
      if (received == null) return t("charge.invalidAmount");
      if (!(cashDue > 0)) return t("charge.invalidAmount");
      if (received < cashDue) return t("charge.insufficient");
    } else if (nonCash < total) {
      return `${t("charge.missing")}: ${formatMoney(round(total - nonCash))}`;
    }
    return null;
  };

  const payload = (): ChargePaymentInput[] =>
    rows.map((row) => {
      if (row.method === "cash") return { method: "cash", amount_received: received ?? 0 };
      if (row.method === "transfer") return { method: "transfer", amount: amountOf(row), reference: row.reference.trim() };
      const terminal = row.terminalId ?? defaultTerminal;
      return {
        method: "card",
        amount: amountOf(row),
        ...(terminal != null ? { terminal_id: terminal } : {}),
        ...(row.authorization.trim() ? { authorization_code: row.authorization.trim() } : {}),
        ...(row.last4 ? { card_last4: row.last4 } : {}),
      };
    });

  const submit = async () => {
    if (inFlight.current) return;
    const problem = validate();
    if (problem) return fail(problem);
    setError(null);
    inFlight.current = true;
    setBusy(true);
    try {
      await onSubmit({ payments: payload() });
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

      {rows.map((row, index) => {
        const body = (
          <View style={{ gap: space[3] }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <AppText variant="label" tone="muted">
                {(single ? t("charge.method") : t("charge.paymentN", { n: index + 1 })).toUpperCase()}
              </AppText>
              {!single ? (
                <Button
                  label={t("charge.removePayment")}
                  variant="danger"
                  icon="trash-2"
                  onPress={() => setRows((prev) => prev.filter((r) => r.key !== row.key))}
                />
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: space[2] }}>
              {METHODS.map(({ value, icon }) => {
                const selected = row.method === value;
                const disabled = value === "cash" && !!cashRow && cashRow.key !== row.key;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={single ? t(`charge.methods.${value}`) : `${t(`charge.methods.${value}`)} ${index + 1}`}
                    accessibilityState={{ selected, disabled }}
                    disabled={disabled}
                    onPress={() => {
                      haptic.select();
                      patch(row.key, { method: value });
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
                      opacity: disabled ? 0.4 : 1,
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

            {row.method === "cash" ? (
              <Animated.View style={[{ gap: space[3] }, shakeStyle]}>
                <Field label={t("charge.received")} icon="dollar-sign" value={row.received} onChangeText={(value) => patch(row.key, { received: value })} keyboardType="decimal-pad" testID="charge-received" />
                <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }}>
                  <Chip label={t("charge.exact")} selected={received === cashDue} onPress={() => patch(row.key, { received: String(cashDue) })} />
                  {quickAmounts(Math.max(0, cashDue)).map((bill) => (
                    <Chip key={bill} label={formatMoney(bill).replace(".00", "")} selected={received === bill} onPress={() => patch(row.key, { received: String(bill) })} />
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
            ) : !single ? (
              <Field label={t("charge.amount")} icon="dollar-sign" value={row.amount} onChangeText={(value) => patch(row.key, { amount: value })} keyboardType="decimal-pad" testID={`charge-amount-${index}`} />
            ) : null}

            {row.method === "card" ? (
              <>
                <TerminalPicker terminals={terminals} value={row.terminalId ?? defaultTerminal} onChange={(id) => patch(row.key, { terminalId: id })} />
                <View style={{ flexDirection: "row", gap: space[2] }}>
                  <View style={{ flex: 1 }}>
                    <Field label={t("charge.authorization")} value={row.authorization} onChangeText={(value) => patch(row.key, { authorization: value })} maxLength={12} autoCapitalize="characters" testID={`charge-auth-${index}`} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label={t("charge.last4")} value={row.last4} onChangeText={(value) => patch(row.key, { last4: value.replace(/\D/g, "") })} keyboardType="number-pad" maxLength={4} testID={`charge-last4-${index}`} />
                  </View>
                </View>
                <AppText tone="muted">
                  {t("charge.optionalVoucher")}
                </AppText>
              </>
            ) : null}

            {row.method === "transfer" ? (
              <Field label={t("checkout.reference")} value={row.reference} onChangeText={(value) => patch(row.key, { reference: value })} maxLength={60} testID={`charge-reference-${index}`} />
            ) : null}
          </View>
        );
        return single ? <View key={row.key}>{body}</View> : <Card key={row.key}>{body}</Card>;
      })}

      {rows.length < MAX_PAYMENTS ? <Button label={t("charge.addPayment")} variant="tonal" icon="plus" onPress={addRow} /> : null}

      {error ? (
        <AppText tone="stamp" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}

      <Button label={t("charge.submit", { total: formatMoney(total) })} icon="check" onPress={() => void submit()} loading={busy} disabled={blocked || busy} />
    </View>
  );
}
