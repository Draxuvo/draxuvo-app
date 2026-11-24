import { useRef, useState } from "react";
import { View } from "react-native";
import type { PaymentBody } from "@/api/restaurant";
import type { PaymentMethod, PaymentTerminal, TerminalCharge } from "@/api/types";
import type { TerminalChargeInput } from "@/api/terminal-charges";
import { TerminalWait } from "./terminal-charge/terminal-wait";
import { isIntegrated, useTerminalCharge } from "./terminal-charge/use-terminal-charge";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { changeOrMissing, formatMoney, parseMoney } from "@/lib/money";
import { space } from "@/theme";
import { TerminalPicker } from "./terminal-picker";
import { useRememberedTerminal } from "@/lib/remembered-terminal";
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
 * negocio en que se cobró (spec 015). La referencia solo es obligatoria en la transferencia (spec 054, H-51): con
 * tarjeta es opcional y se manda si se captura, igual que en el cobro de una orden.
 */
export function PaymentForm({
  balance,
  terminals = [],
  onSubmit,
  checkId,
  onTerminalApplied,
  onIncomplete,
}: {
  balance: number;
  terminals?: PaymentTerminal[];
  onSubmit: (body: PaymentBody) => Promise<void>;
  /** Spec 069: con la cuenta, un abono con tarjeta en terminal integrada se manda a la terminal. */
  checkId?: number;
  onTerminalApplied?: (charge: TerminalCharge) => void;
  /** Artículos sin entregar al mandar a la terminal: la pantalla pregunta y vuelve a llamar con `confirm`. */
  onIncomplete?: (pending: number, confirm: () => void) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState(fixed(balance));
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [terminalId, setTerminalId] = useState<number | null>(null);
  // Spec 069 (US4): la única terminal, o la última usada en este teléfono si sigue activa.
  const { defaultTerminal, remember } = useRememberedTerminal(terminals);
  const terminal = terminalId ?? defaultTerminal;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const chosen = terminals.find((x) => x.id === terminal);
  const toTerminal = checkId != null && method === "card" && !manual && isIntegrated(chosen);
  const [lastInput, setLastInput] = useState<TerminalChargeInput | null>(null);
  const terminalCharge = useTerminalCharge({
    onApplied: (charge) => onTerminalApplied?.(charge),
    onStartError: (err) => {
      if (err.code !== "incomplete_items" || !lastInput) return false;
      const retry = lastInput;
      terminalCharge.reset();
      onIncomplete?.(err.pending ?? 0, () => startTerminal({ ...retry, params: { confirm_incomplete: true } }));
      return true;
    },
  });
  const startTerminal = (input: TerminalChargeInput) => {
    setLastInput(input);
    terminalCharge.start(input);
  };
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
      if (method === "transfer" && !reference.trim()) return fail(t("checkout.referenceRequired"));
      if (method === "card" && terminals.length > 0 && terminal == null) return fail(t("charge.terminalRequired"));
    } else if (got != null && got < covered) {
      return fail(t("charge.insufficient"));
    }
    setError(null);
    if (method === "card") remember(terminal);
    if (toTerminal && chosen && checkId != null) {
      startTerminal({ terminal_id: chosen.id, amount: due, owner: { type: "check", id: checkId }, params: {} });
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      const body: PaymentBody =
        method === "cash"
          ? { method, amount: fixed(due), amount_received: fixed(got ?? due) }
          : {
              method,
              amount: fixed(due),
              ...(reference.trim() ? { reference: reference.trim() } : {}),
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

  if (terminalCharge.active && lastInput) {
    return (
      <TerminalWait
        amount={lastInput.amount}
        terminalName={chosen?.name ?? ""}
        charge={terminalCharge.charge}
        starting={terminalCharge.starting}
        error={terminalCharge.startError}
        canceling={terminalCharge.canceling}
        onCancel={terminalCharge.cancel}
        onRetry={() => terminalCharge.start(lastInput)}
        onChooseOther={terminalCharge.reset}
        onManual={() => void terminalCharge.abandon().then(() => setManual(true))}
      />
    );
  }

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
          {method === "card" ? (
            <TerminalPicker
              terminals={terminals}
              value={terminal}
              onChange={(id) => {
                setTerminalId(id);
                setManual(false);
              }}
            />
          ) : null}
          {manual && method === "card" && isIntegrated(chosen) ? <AppText tone="muted">{t("terminalCharge.manualHint", { terminal: chosen?.name ?? "" })}</AppText> : null}
          {toTerminal ? null : (
            <Field label={method === "card" ? t("checkout.referenceOptional") : t("checkout.reference")} value={reference} onChangeText={setReference} placeholder={t("checkout.referencePlaceholder")} autoCapitalize="characters" />
          )}
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
