import { useRef, useState } from "react";
import { View } from "react-native";
import type { PaymentBody } from "@/api/restaurant";
import type { PaymentMethod, PaymentTerminal } from "@/api/types";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { changeOrMissing, formatMoney, parseMoney } from "@/lib/money";
import { space } from "@/theme";
import { TerminalPicker } from "./terminal-picker";
import { AppText, Button, Chip, Field, type IconName } from "./ui";

const METHODS: { value: PaymentMethod; icon: IconName }[] = [
  { value: "cash", icon: "dollar-sign" },
  { value: "card", icon: "credit-card" },
  { value: "transfer", icon: "repeat" },
];

const fixed = (value: number) => value.toFixed(2);

/**
 * Un pago de la cuenta. El monto empieza en el saldo; en efectivo se captura lo recibido y se calcula
 * el cambio, y con tarjeta o transferencia se captura la referencia (FR-021 a FR-023). El botón se bloquea
 * hasta recibir respuesta: un doble toque no cobra dos veces. Con tarjeta se elige además la terminal del
 * negocio en que se cobró (spec 015); la referencia sigue siendo obligatoria.
 */
export function PaymentForm({
  balance,
  terminals = [],
  onSubmit,
}: {
  balance: number;
  terminals?: PaymentTerminal[];
  onSubmit: (body: PaymentBody) => Promise<void>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState(fixed(balance));
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [terminalId, setTerminalId] = useState<number | null>(null);
  const terminal = terminalId ?? (terminals.length === 1 ? terminals[0].id : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const due = parseMoney(amount);
  const got = parseMoney(received);
  const covered = due == null ? 0 : Math.min(due, balance);
  const diff = method === "cash" && got != null && due != null ? changeOrMissing(covered, got) : null;

  const submit = async () => {
    if (inFlight.current) return;
    if (due == null || due <= 0) return fail(t("checkout.invalidAmount"));
    if (method !== "cash") {
      if (due > balance) return fail(t("checkout.exceeds"));
      if (!reference.trim()) return fail(t("checkout.referenceRequired"));
      if (method === "card" && terminals.length > 0 && terminal == null) return fail(t("charge.terminalRequired"));
    } else if (got != null && got < covered) {
      return fail(t("charge.insufficient"));
    }
    setError(null);
    inFlight.current = true;
    setBusy(true);
    try {
      const body: PaymentBody =
        method === "cash"
          ? { method, amount: fixed(due), amount_received: fixed(got ?? due) }
          : {
              method,
              amount: fixed(due),
              reference: reference.trim(),
              ...(method === "card" && terminal != null ? { terminal_id: terminal } : {}),
            };
      await onSubmit(body);
      setReceived("");
      setReference("");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const fail = (message: string) => {
    haptic.warning();
    setError(message);
  };

  return (
    <View style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", gap: space[2], flexWrap: "wrap" }} accessibilityRole="radiogroup" accessibilityLabel={t("checkout.method")}>
        {METHODS.map((item) => (
          <Chip key={item.value} role="radio" icon={item.icon} label={t(`checkout.methods.${item.value}`)} selected={method === item.value} onPress={() => setMethod(item.value)} />
        ))}
      </View>
      <Field label={t("checkout.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal" />
      {method === "cash" ? (
        <>
          <Field label={t("checkout.amountReceived")} value={received} onChangeText={setReceived} placeholder={fixed(covered)} keyboardType="decimal-pad" inputMode="decimal" />
          {diff ? (
            <AppText variant="bodyStrong" tone={diff.missing > 0 ? "stamp" : "ok"} accessibilityLiveRegion="polite" testID="payment-change">
              {diff.missing > 0 ? `${t("charge.missing")}: ${formatMoney(diff.missing)}` : `${t("checkout.change")}: ${formatMoney(diff.change)}`}
            </AppText>
          ) : null}
        </>
      ) : (
        <>
          {method === "card" ? <TerminalPicker terminals={terminals} value={terminal} onChange={setTerminalId} /> : null}
          <Field label={t("checkout.reference")} value={reference} onChangeText={setReference} placeholder={t("checkout.referencePlaceholder")} autoCapitalize="characters" />
        </>
      )}
      {error ? (
        <AppText tone="stamp" accessibilityRole="alert" testID="payment-error">
          {error}
        </AppText>
      ) : null}
      <Button label={busy ? t("checkout.paying") : t("checkout.addPayment")} icon="check" loading={busy} onPress={() => void submit()} />
    </View>
  );
}
