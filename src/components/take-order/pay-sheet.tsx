import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { ApiError, NetworkError } from "@/api/client";
import { chargeOrder, type ChargeBody } from "@/api/orders";
import { addPayment, type PaymentBody } from "@/api/restaurant";
import { useTerminals } from "@/api/terminals";
import { ChargeForm } from "@/components/charge-form";
import { describeError } from "@/components/error-view";
import { PaymentForm } from "@/components/payment-form";
import { AppText, Divider, IconButton, KeyboardFrame } from "@/components/ui";
import { useApplyCheck } from "@/hooks/use-restaurant";
import { useApplyOrder } from "@/hooks/use-orders";
import { haptic } from "@/lib/haptics";
import { formatMoney } from "@/lib/money";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import type { CurrentOrder } from "./use-order-source";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
      <AppText tone="muted">{label}</AppText>
      <AppText variant={strong ? "title" : "bodyStrong"}>{value}</AppText>
    </View>
  );
}

/**
 * Cobro sin salir de la pantalla (spec 018, FR-016): una hoja con el formulario que ya existe, el de pagos
 * de la cuenta o el de cobro de la orden. Al cubrirse, abre el ticket.
 */
export function PaySheet({ current, visible, onClose, onPaid }: { current: CurrentOrder | null; visible: boolean; onClose: () => void; onPaid: (ticketId: number) => void }) {
  const { c } = useTheme();
  const terminals = useTerminals();
  const applyCheck = useApplyCheck();
  const applyOrder = useApplyOrder();
  const [message, setMessage] = useState<string | null>(null);
  // La llave de un cobro se conserva hasta el 2xx: reintentar por mala red nunca cobra dos veces.
  const key = useRef<string | null>(null);

  const check = current?.check;
  const order = current?.order;

  const submitCheck = async (body: PaymentBody) => {
    if (!check) return;
    setMessage(null);
    key.current ??= Crypto.randomUUID();
    try {
      const result = await addPayment(check.id, body, key.current);
      key.current = null;
      haptic.success();
      applyCheck({ ...check, status: result.check.status, total: result.check.total, paid: result.check.paid, balance: result.check.balance });
      if (result.ticket) onPaid(result.ticket.id);
    } catch (failure) {
      if (!(failure instanceof NetworkError)) key.current = null;
      haptic.warning();
      if (failure instanceof ApiError && failure.code === "incomplete_items") {
        const pending = Number((failure.details as { pending?: number }).pending ?? 0);
        Alert.alert(t("checkout.incompleteTitle"), t("checkout.incompleteBody", { count: pending }), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("checkout.chargeAnyway"), onPress: () => void submitCheck({ ...body, confirm_incomplete: true }) },
        ]);
        return;
      }
      setMessage(failure instanceof NetworkError ? t("checkout.payError") : describeError(failure));
    }
  };

  const submitOrder = async (body: ChargeBody) => {
    if (!order) return;
    setMessage(null);
    key.current ??= Crypto.randomUUID();
    try {
      const charged = await chargeOrder(order.id, body, key.current);
      key.current = null;
      haptic.success();
      applyOrder(charged);
      if (charged.ticket) onPaid(charged.ticket.id);
    } catch (failure) {
      if (!(failure instanceof NetworkError)) key.current = null;
      haptic.warning();
      setMessage(describeError(failure));
    }
  };

  const balance = Number(check?.balance ?? 0);

  return (
    <Modal visible={visible && !!current} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel={t("common.close")} onPress={onClose} style={{ flex: 1, backgroundColor: c.scrim }} />
      <KeyboardFrame>
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space[5], gap: space[3], maxHeight: "92%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText variant="title" accessibilityRole="header">
              {t("checkout.title")}
            </AppText>
            <IconButton icon="x" label={t("common.close")} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space[4], paddingBottom: space[4] }}>
            {check ? (
              <>
                <View style={{ gap: space[2] }}>
                  <Row label={t("checkout.total")} value={formatMoney(check.total)} />
                  <Row label={t("checkout.paid")} value={formatMoney(check.paid)} />
                  <Divider />
                  <Row label={t("checkout.balance")} value={formatMoney(check.balance)} strong />
                </View>
                {balance > 0 && check.status === "open" ? (
                  <PaymentForm key={check.payments.length} balance={balance} terminals={terminals.data ?? []} onSubmit={submitCheck} />
                ) : null}
              </>
            ) : order ? (
              <ChargeForm total={Number(order.total ?? 0)} blocked={order.charge_blocked_reason === "no_items"} terminals={terminals.data ?? []} onSubmit={submitOrder} />
            ) : null}
            {message ? (
              <AppText tone="stamp" accessibilityRole="alert" testID="pay-error">
                {message}
              </AppText>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardFrame>
    </Modal>
  );
}
