import { View } from "react-native";
import type { CheckItem, ItemStatus } from "@/api/types";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { ProductGlyph } from "./product-icon";
import { QtyButton } from "./qty-button";
import { AppText, Button } from "./ui";

function money(value: string | number): string {
  return `$${Number(value).toFixed(2)}`;
}

function StatusTag({ status }: { status: ItemStatus }) {
  const { c } = useTheme();
  const tones: Record<ItemStatus, { bg: string; fg: string; border: string }> = {
    draft: { bg: "transparent", fg: c.inkMuted, border: c.line },
    new: { bg: c.surfaceAlt, fg: c.ink, border: c.line },
    preparing: { bg: c.marker, fg: c.onMarker, border: c.marker },
    ready: { bg: c.okSoft, fg: c.onOkSoft, border: c.ok },
    delivered: { bg: "transparent", fg: c.inkMuted, border: c.line },
    cancelled: { bg: c.stampSoft, fg: c.onStampSoft, border: c.stampSoft },
  };
  const tone = tones[status];
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: tone.bg, borderColor: tone.border, borderWidth: 1.5, borderRadius: radius.chip - 6, paddingHorizontal: space[2], paddingVertical: 2 }}>
      <AppText variant="label" style={{ color: tone.fg }}>
        {t(`check.status.${status}`).toUpperCase()}
      </AppText>
    </View>
  );
}

/** Renglón de la cuenta: solo dibuja las acciones que la API permite (`allowed_actions`). */
export function CheckLine({
  item,
  onDeliver,
  onCancel,
  onRemove,
  onQuantity,
  busy,
}: {
  item: CheckItem;
  onDeliver: (item: CheckItem) => void;
  onCancel: (item: CheckItem) => void;
  onRemove: (item: CheckItem) => void;
  onQuantity: (item: CheckItem, quantity: number) => void;
  busy?: boolean;
}) {
  const { c } = useTheme();
  const cancelled = item.status === "cancelled";
  const draft = item.status === "draft";
  const label = `${item.quantity} ${item.name}, ${t(`check.status.${item.status}`)}`;

  return (
    <View accessible={false} style={{ gap: space[2], paddingVertical: space[3] }} testID={`check-line-${item.id}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ flex: 1, flexDirection: "row", gap: space[2] }}>
        <View style={{ paddingTop: 2 }}>
          <ProductGlyph product={item} color={c.inkMuted} />
        </View>
        <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={label}>
          <AppText variant="bodyStrong" style={cancelled ? { textDecorationLine: "line-through" } : undefined}>
            {item.quantity} × {item.name}
          </AppText>
          {item.note ? (
            <AppText tone="muted" variant="body">
              {item.note}
            </AppText>
          ) : null}
          {item.station ? (
            <AppText variant="label" tone="muted">
              {t("check.station", { name: item.station.name })}
            </AppText>
          ) : null}
        </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: space[1] }}>
          <AppText variant="bodyStrong" tone={cancelled ? "muted" : "ink"}>
            {money(Number(item.unit_price) * item.quantity)}
          </AppText>
          {draft ? null : <StatusTag status={item.status} />}
        </View>
      </View>

      {draft ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <QtyButton kind="minus" label={t("takeOrder.dec", { name: item.name })} disabled={busy || item.quantity <= 1} onPress={() => onQuantity(item, item.quantity - 1)} />
          <QtyButton kind="plus" label={t("takeOrder.inc", { name: item.name })} disabled={busy} onPress={() => onQuantity(item, item.quantity + 1)} />
          <View style={{ flex: 1 }} />
          <Button label={t("check.remove")} variant="text" icon="trash-2" disabled={busy} onPress={() => onRemove(item)} />
        </View>
      ) : item.allowed_actions.length > 0 ? (
        <View style={{ flexDirection: "row", gap: space[2], justifyContent: "flex-end" }}>
          {item.allowed_actions.includes("cancel") ? <Button label={t("check.cancelItem")} variant="text" disabled={busy} onPress={() => onCancel(item)} /> : null}
          {item.allowed_actions.includes("deliver") ? <Button label={t("check.deliver")} variant="tonal" icon="check" disabled={busy} onPress={() => onDeliver(item)} /> : null}
        </View>
      ) : null}
    </View>
  );
}
