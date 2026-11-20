import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { TerminalCharge } from "@/api/types";
import { t } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { radius, space, useTheme } from "@/theme";
import { AppText, Button, Icon } from "../ui";
import type { TerminalChargeError } from "./use-terminal-charge";

const WAITING = new Set(["pending", "canceling", "approved", "applied"]);
const DETAILS = new Set([
  "created", "at_terminal", "cancellation_requested", "rejected_by_issuer", "insufficient_amount", "high_risk", "bad_filled_card_data",
  "card_disabled", "amount_limit_exceeded", "max_attempts_exceeded", "required_call_for_authorize", "processing_error",
  "invalid_installments", "in_review", "canceled_on_terminal", "canceled_by_api", "expired", "check_on_terminal", "waiting_payment",
  "provider_unavailable", "amount_out_of_range", "device_offline",
]);
const ERRORS = new Set([
  "terminal_busy", "terminal_charge_pending", "terminal_not_chargeable", "amount_out_of_range", "one_integrated_payment",
  "provider_unavailable", "device_offline", "declined", "not_cancelable", "charge_boss_only",
]);

/**
 * «Esperando terminal…» (spec 069, US1 y US3): monto, terminal y estado mientras la solicitud espera; al fallar o vencer,
 * reintentar, elegir otra terminal o registrar a mano (con aviso de revisar la terminal).
 */
export function TerminalWait({
  amount, terminalName, charge, starting, error, canceling, onCancel, onRetry, onChooseOther, onManual,
}: {
  amount: number;
  terminalName: string;
  charge: TerminalCharge | null;
  starting: boolean;
  error: TerminalChargeError | null;
  canceling: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onChooseOther: () => void;
  onManual: () => void;
}) {
  const { c } = useTheme();
  const [confirmManual, setConfirmManual] = useState(false);
  const status = charge?.status;
  const waiting = !error && (starting || !status || WAITING.has(status));
  const detail = charge?.status_detail && DETAILS.has(charge.status_detail) ? t(`terminalCharge.details.${charge.status_detail}`) : null;

  let failure: string | null = null;
  if (error) failure = ERRORS.has(error.code) ? t(`terminalCharge.errors.${error.code}`) : t("terminalCharge.errors.generic");
  else if (status === "unapplied") failure = t("terminalCharge.unapplied");
  else if (status && !WAITING.has(status)) failure = detail ?? t(`terminalCharge.statuses.${status === "abandoned" ? "canceled" : status}`);

  return (
    <View style={{ gap: space[4], alignItems: "stretch" }} testID="terminal-wait">
      <AppText variant="figureLarge" style={{ textAlign: "center" }}>
        {formatMoney(amount)}
      </AppText>
      <View style={{ flexDirection: "row", gap: space[2], justifyContent: "center", alignItems: "center" }}>
        <Icon name="credit-card" tone="muted" />
        <AppText tone="muted">{terminalName}</AppText>
      </View>

      {waiting ? (
        <View accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: space[2] }}>
          <ActivityIndicator color={c.primary} />
          <AppText variant="title">{status === "canceling" ? t("terminalCharge.canceling") : t("terminalCharge.waiting")}</AppText>
          <AppText tone="muted" style={{ textAlign: "center" }}>
            {detail ?? t("terminalCharge.waitingHint")}
          </AppText>
        </View>
      ) : (
        <View accessibilityRole="alert" style={{ backgroundColor: c.stampSoft, borderRadius: radius.field, padding: space[3], gap: space[2] }}>
          <AppText variant="bodyStrong" style={{ color: c.onStampSoft }}>
            {failure}
          </AppText>
        </View>
      )}

      {confirmManual ? (
        <AppText tone="muted" accessibilityRole="alert">
          {t("terminalCharge.manualWarning")}
        </AppText>
      ) : null}

      {waiting ? (
        <>
          {status === "pending" ? <Button label={t("terminalCharge.cancel")} variant="tonal" onPress={onCancel} disabled={canceling} /> : null}
          {status === "pending" || status === "canceling" ? (
            confirmManual ? (
              <Button label={t("terminalCharge.manualConfirm")} variant="tonal" onPress={onManual} />
            ) : (
              <Button label={t("terminalCharge.manual")} variant="text" onPress={() => setConfirmManual(true)} />
            )
          ) : null}
        </>
      ) : (
        <>
          {status !== "unapplied" ? <Button label={t("terminalCharge.retry")} icon="refresh-cw" onPress={onRetry} /> : null}
          <Button label={t("terminalCharge.chooseOther")} variant="tonal" onPress={onChooseOther} />
          {status !== "unapplied" ? <Button label={t("terminalCharge.manual")} variant="text" onPress={onManual} /> : null}
        </>
      )}
    </View>
  );
}
