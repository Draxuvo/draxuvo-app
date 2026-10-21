import { View } from "react-native";
import { t } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { radius, space, useTheme } from "@/theme";
import { AppText, Button, Divider } from "../ui";
import type { Line } from "./lib";
import type { CurrentOrder } from "./use-order-source";

function LineRow({ line, busy, onQuantity, onRemove }: { line: Line; busy: boolean; onQuantity: (line: Line, quantity: number) => void; onRemove: (line: Line) => void }) {
  return (
    <View style={{ gap: space[2], paddingVertical: space[2] }} testID={`order-line-${line.id}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ flex: 1 }} accessible accessibilityLabel={`${line.quantity} ${line.name}`}>
          <AppText variant="bodyStrong">{line.name}</AppText>
          {line.note ? <AppText tone="muted">{line.note}</AppText> : null}
        </View>
        <AppText variant="bodyStrong">{formatMoney(line.unit_price * line.quantity)}</AppText>
      </View>
      {line.editable ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Button label="−" variant="outline" accessibilityHint={t("takeOrder.dec", { name: line.name })} disabled={busy} onPress={() => onQuantity(line, line.quantity - 1)} style={{ width: 52 }} />
          <AppText variant="figure" style={{ minWidth: 32, textAlign: "center" }} accessibilityLabel={`${t("check.quantity")} ${line.quantity}`}>
            {line.quantity}
          </AppText>
          <Button label="+" variant="outline" accessibilityHint={t("takeOrder.inc", { name: line.name })} disabled={busy} onPress={() => onQuantity(line, line.quantity + 1)} style={{ width: 52 }} />
          <View style={{ flex: 1 }} />
          <Button label={t("check.remove")} variant="text" icon="trash-2" disabled={busy} onPress={() => onRemove(line)} />
        </View>
      ) : (
        <AppText variant="label" tone="muted">
          ×{line.quantity}
        </AppText>
      )}
    </View>
  );
}

/** La orden de la mesa elegida: renglones con + y −, total y las acciones que la API permite. */
export function OrderPanel({
  current,
  loading,
  busy,
  sending,
  onQuantity,
  onRemove,
  onAddMore,
  onSend,
  onCharge,
  onOpenCheck,
}: {
  current: CurrentOrder | null;
  loading: boolean;
  busy: boolean;
  sending: boolean;
  onQuantity: (line: Line, quantity: number) => void;
  onRemove: (line: Line) => void;
  /** En el teléfono lleva a la pestaña del menú. */
  onAddMore?: () => void;
  onSend: () => void;
  onCharge: () => void;
  /** Cuenta completa: entregar, cancelar, cambiar de mesero. */
  onOpenCheck?: () => void;
}) {
  const { c } = useTheme();
  if (!current) {
    return (
      <AppText tone="muted" style={{ padding: space[4] }}>
        {loading ? t("common.loading") : t("takeOrder.pickTable")}
      </AppText>
    );
  }
  const live = current.lines.filter((l) => !l.cancelled);
  const draft = live.filter((l) => l.editable);
  const sent = live.filter((l) => !l.editable);

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText variant="headline" accessibilityRole="header">
          {current.title}
        </AppText>
        {onOpenCheck ? <Button label={t("takeOrder.fullCheck")} variant="text" icon="list" onPress={onOpenCheck} /> : null}
      </View>
      {!live.length ? <AppText tone="muted">{t("takeOrder.orderEmpty")}</AppText> : null}
      {draft.length ? (
        <View>
          {sent.length ? (
            <AppText variant="label" tone="muted" accessibilityRole="header">
              {t("check.draftSection").toUpperCase()}
            </AppText>
          ) : null}
          {draft.map((line) => (
            <LineRow key={line.id} line={line} busy={busy} onQuantity={onQuantity} onRemove={onRemove} />
          ))}
        </View>
      ) : null}
      {sent.length ? (
        <View>
          <Divider />
          <AppText variant="label" tone="muted" accessibilityRole="header" style={{ marginTop: space[2] }}>
            {t("takeOrder.sentSection").toUpperCase()}
          </AppText>
          {sent.map((line) => (
            <LineRow key={line.id} line={line} busy={busy} onQuantity={onQuantity} onRemove={onRemove} />
          ))}
        </View>
      ) : null}

      <View style={{ gap: space[3], padding: space[3], borderRadius: radius.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <AppText variant="title">{t("check.total")}</AppText>
          <AppText variant="figure" accessibilityLabel={`${t("check.total")} ${formatMoney(current.total)}`}>
            {formatMoney(current.total)}
          </AppText>
        </View>
        <View style={{ flexDirection: "row", gap: space[3] }}>
          {onAddMore && current.canAdd ? <Button label={t("check.add")} icon="plus" variant="outline" onPress={onAddMore} style={{ flex: 1 }} /> : null}
          {current.canSend ? <Button label={sending ? t("check.sending") : t("check.send")} icon="send" loading={sending} onPress={onSend} style={{ flex: 1 }} /> : null}
          {current.canCharge ? <Button label={current.order && current.order.status !== "done" ? t("takeOrder.finishCharge") : t("check.pay")} icon="credit-card" onPress={onCharge} style={{ flex: 1 }} /> : null}
        </View>
      </View>
    </View>
  );
}
