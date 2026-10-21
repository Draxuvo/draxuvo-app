import { useState } from "react";
import { View } from "react-native";
import { t } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { radius, space, useTheme } from "@/theme";
import type { CheckItem } from "@/api/types";
import { CheckLine } from "../check-line";
import { ProductGlyph } from "../product-icon";
import { QtyButton } from "../qty-button";
import { AppText, Button, Divider, Field } from "../ui";
import { groupByRound, type Line } from "./lib";
import type { CurrentOrder } from "./use-order-source";

function LineRow({
  line,
  busy,
  canNote,
  onQuantity,
  onRemove,
  onNote,
}: {
  line: Line;
  busy: boolean;
  canNote: boolean;
  onQuantity: (line: Line, quantity: number) => void;
  onRemove: (line: Line) => void;
  onNote: (line: Line, note: string) => void;
}) {
  const { c } = useTheme();
  const [noting, setNoting] = useState(false);
  const [text, setText] = useState(line.note ?? "");
  const save = () => {
    onNote(line, text.trim());
    setNoting(false);
  };
  return (
    <View style={{ gap: space[2], paddingVertical: space[2] }} testID={`order-line-${line.id}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <ProductGlyph product={line} color={c.inkMuted} />
          <View style={{ flex: 1 }} accessible accessibilityLabel={`${line.quantity} ${line.name}${line.note ? `, ${line.note}` : ""}`}>
            <AppText variant="bodyStrong">{line.name}</AppText>
            {line.note && !noting ? <AppText tone="muted">{line.note}</AppText> : null}
          </View>
        </View>
        <AppText variant="bodyStrong">{formatMoney(line.unit_price * line.quantity)}</AppText>
      </View>
      {line.editable ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <QtyButton kind="minus" label={t("takeOrder.dec", { name: line.name })} disabled={busy} onPress={() => onQuantity(line, line.quantity - 1)} />
            <AppText variant="figure" style={{ minWidth: 32, textAlign: "center" }} accessibilityLabel={`${t("check.quantity")} ${line.quantity}`}>
              {line.quantity}
            </AppText>
            <QtyButton kind="plus" label={t("takeOrder.inc", { name: line.name })} disabled={busy} onPress={() => onQuantity(line, line.quantity + 1)} />
            <View style={{ flex: 1 }} />
            <Button label={t("check.remove")} variant="text" icon="trash-2" disabled={busy} onPress={() => onRemove(line)} />
          </View>
          {canNote ? (
            noting ? (
              <View style={{ gap: space[2] }}>
                <Field label={t("check.note")} value={text} onChangeText={setText} placeholder={t("check.notePlaceholder")} returnKeyType="done" onSubmitEditing={save} autoFocus />
                <View style={{ flexDirection: "row", gap: space[2] }}>
                  <Button label={t("common.cancel")} variant="outline" onPress={() => { setText(line.note ?? ""); setNoting(false); }} style={{ flex: 1 }} />
                  <Button label={t("takeOrder.noteSave")} icon="check" onPress={save} style={{ flex: 1 }} />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: "row" }}>
                <Button label={line.note ? t("takeOrder.noteEdit") : t("check.note")} variant="text" icon="edit-3" disabled={busy} onPress={() => { setText(line.note ?? ""); setNoting(true); }} />
              </View>
            )
          ) : null}
        </>
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
  missing,
  busy,
  sending,
  canNote,
  onQuantity,
  onRemove,
  onNote,
  onAddMore,
  onSend,
  onCharge,
  onRelease,
  onReassign,
  onDeliver,
  onCancelItem,
  onViewTicket,
  hideTitle,
}: {
  current: CurrentOrder | null;
  loading: boolean;
  /** La cuenta u orden elegida ya no existe o no es de esta empresa. */
  missing?: boolean;
  busy: boolean;
  sending: boolean;
  /** Solo las cuentas de mesa llevan nota por renglón. */
  canNote: boolean;
  onQuantity: (line: Line, quantity: number) => void;
  onRemove: (line: Line) => void;
  onNote: (line: Line, note: string) => void;
  /** En el teléfono lleva a la pestaña del menú. */
  onAddMore?: () => void;
  onSend: () => void;
  onCharge: () => void;
  onRelease: () => void;
  /** Pasar la cuenta a otro mesero (solo encargados). */
  onReassign?: () => void;
  /** Entregar un producto listo y cancelar uno ya mandado (spec 025). */
  onDeliver: (item: CheckItem) => void;
  onCancelItem: (item: CheckItem) => void;
  /** Cuenta cerrada: abre su ticket. */
  onViewTicket?: () => void;
  /** En la hoja el título ya está en su encabezado. */
  hideTitle?: boolean;
}) {
  const { c } = useTheme();
  if (!current) {
    return (
      <AppText tone="muted" style={{ padding: space[4] }}>
        {loading ? t("common.loading") : missing ? t("takeOrder.orderGone") : t("takeOrder.pickTable")}
      </AppText>
    );
  }
  const live = current.lines.filter((l) => !l.cancelled);
  const draft = live.filter((l) => l.editable);
  const sent = live.filter((l) => !l.editable);

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space[1] }}>
        {hideTitle ? null : (
          <AppText variant="headline" accessibilityRole="header">
            {current.title}
          </AppText>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
          {current.canRelease ? <Button label={t("takeOrder.release")} variant="text" icon="log-out" onPress={onRelease} /> : null}
          {current.canReassign && onReassign ? <Button label={t("takeOrder.reassign")} variant="text" icon="users" onPress={onReassign} /> : null}
        </View>
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
            <LineRow key={line.id} line={line} busy={busy} canNote={canNote} onQuantity={onQuantity} onRemove={onRemove} onNote={onNote} />
          ))}
        </View>
      ) : null}
      {current.check ? (
        groupByRound(current.check.items).map((round) => (
          <View key={round.number} testID={`round-${round.number}`}>
            <Divider />
            <AppText variant="label" tone="muted" accessibilityRole="header" style={{ marginTop: space[2] }}>
              {t("takeOrder.round", { number: round.number }).toUpperCase()}
            </AppText>
            {round.items.map((item) => (
              <CheckLine key={item.id} item={item} busy={busy} onDeliver={onDeliver} onCancel={onCancelItem} onRemove={() => undefined} onQuantity={() => undefined} />
            ))}
          </View>
        ))
      ) : sent.length ? (
        <View>
          <Divider />
          <AppText variant="label" tone="muted" accessibilityRole="header" style={{ marginTop: space[2] }}>
            {t("takeOrder.sentSection").toUpperCase()}
          </AppText>
          {sent.map((line) => (
            <LineRow key={line.id} line={line} busy={busy} canNote={canNote} onQuantity={onQuantity} onRemove={onRemove} onNote={onNote} />
          ))}
        </View>
      ) : null}

      {current.readOnly ? (
        <View style={{ gap: space[2] }}>
          <AppText variant="bodyStrong" tone="ok" testID="check-closed">
            {t("takeOrder.readOnly")}
          </AppText>
          {onViewTicket && current.ticketId ? <Button label={t("takeOrder.viewTicket")} icon="file-text" variant="outline" onPress={onViewTicket} /> : null}
        </View>
      ) : null}

      <View style={{ gap: space[3], padding: space[3], borderRadius: radius.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <AppText variant="title">{t("check.total")}</AppText>
          <AppText variant="figure" accessibilityLabel={`${t("check.total")} ${formatMoney(current.total)}`}>
            {formatMoney(current.total)}
          </AppText>
        </View>
        <View style={{ gap: space[2] }}>
          {current.canSend || current.canCharge ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[3] }}>
              {current.canSend ? <Button label={sending ? t("check.sending") : t("check.send")} icon="send" loading={sending} onPress={onSend} style={{ flex: 1, minWidth: 140 }} /> : null}
              {current.canCharge ? <Button label={current.order && current.order.status !== "done" ? t("takeOrder.finishCharge") : t("check.pay")} icon="credit-card" onPress={onCharge} style={{ flex: 1, minWidth: 140 }} /> : null}
            </View>
          ) : null}
          {onAddMore && current.canAdd ? <Button label={t("takeOrder.keepAdding")} icon="plus" variant="outline" onPress={onAddMore} /> : null}
        </View>
      </View>
    </View>
  );
}
