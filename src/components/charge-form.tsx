import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import type { ChargeBody } from "@/api/orders";
import type { PaymentMethod } from "@/api/types";
import { t } from "@/i18n";
import { changeOrMissing, formatMoney, parseMoney } from "@/lib/money";
import { colors, MIN_TOUCH, radii, spacing } from "@/theme";
import { AppText, Button, Field } from "./ui";

const METHODS: PaymentMethod[] = ["cash", "card", "transfer"];

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
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  const amount = parseMoney(received);
  const diff = method === "cash" && amount != null ? changeOrMissing(total, amount) : null;

  const submit = async () => {
    if (inFlight.current) return;
    if (method === "cash") {
      if (amount == null) return setError(t("charge.invalidAmount"));
      if (amount < total) return setError(t("charge.insufficient"));
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
    <View style={{ gap: spacing[4] }}>
      <View>
        <AppText variant="label" muted>
          {t("charge.total").toUpperCase()}
        </AppText>
        <AppText variant="cifra" testID="charge-total">
          {formatMoney(total)}
        </AppText>
      </View>

      {blocked ? (
        <AppText style={{ color: colors.alerta }} accessibilityRole="alert">
          {t("charge.noItems")}
        </AppText>
      ) : null}

      <View style={{ gap: spacing[2] }}>
        <AppText variant="label" muted>
          {t("charge.method").toUpperCase()}
        </AppText>
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          {METHODS.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={t(`charge.methods.${value}`)}
              accessibilityState={{ selected: method === value }}
              onPress={() => {
                setMethod(value);
                setError(null);
              }}
              style={{
                flex: 1,
                minHeight: MIN_TOUCH,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.etiqueta,
                borderWidth: 1.5,
                borderColor: colors.tinta,
                backgroundColor: method === value ? colors.tinta : colors.etiqueta,
              }}
            >
              <AppText variant="bodyStrong" style={{ color: method === value ? colors.etiqueta : colors.tinta }}>
                {t(`charge.methods.${value}`)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      {method === "cash" ? (
        <View style={{ gap: spacing[2] }}>
          <Field label={t("charge.received")} value={received} onChangeText={setReceived} keyboardType="decimal-pad" error={error} testID="charge-received" />
          {diff ? (
            <AppText variant="bodyStrong" style={{ color: diff.missing > 0 ? colors.alerta : colors.sello }} testID="charge-diff">
              {diff.missing > 0 ? `${t("charge.missing")}: ${formatMoney(diff.missing)}` : `${t("charge.change")}: ${formatMoney(diff.change)}`}
            </AppText>
          ) : null}
        </View>
      ) : error ? (
        <AppText style={{ color: colors.alerta }}>{error}</AppText>
      ) : null}

      <Button label={t("charge.submit", { total: formatMoney(total) })} onPress={() => void submit()} loading={busy} disabled={blocked || busy} />
    </View>
  );
}
