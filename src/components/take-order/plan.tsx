import { View } from "react-native";
import { t } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { space, useTheme } from "@/theme";
import { AppText, Button, Card, Field } from "../ui";
import { useState } from "react";
import type { Selection, SourceTile } from "./use-order-source";

/** Plano de mesas (o de órdenes abiertas): un mosaico por mesa con su estado en color y en texto (spec 018). */
export function Plan({
  tiles,
  mode,
  selection,
  onPick,
  onCreate,
  creating,
  loading,
}: {
  tiles: SourceTile[];
  mode: "restaurant" | "orders";
  selection: Selection;
  onPick: (tile: SourceTile) => void;
  onCreate: (name: string) => void;
  creating?: boolean;
  loading?: boolean;
}) {
  const { c } = useTheme();
  const [name, setName] = useState("");
  const selected = (tile: SourceTile) => !!selection && !!tile.selection && tile.selection.kind === selection.kind && tile.selection.id === selection.id;

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    setName("");
  };

  return (
    <View style={{ gap: space[3] }}>
      {!loading && !tiles.length ? (
        <View style={{ gap: space[1] }}>
          <AppText variant="title">{mode === "restaurant" ? t("tables.empty") : t("takeOrder.noOrders")}</AppText>
          {mode === "restaurant" ? <AppText tone="muted">{t("tables.emptyHint")}</AppText> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {tiles.map((tile) => {
          const state = tile.state === "free" ? t("takeOrder.free") : t("takeOrder.occupied");
          const label = tile.state === "occupied" ? `${tile.name}, ${state}, ${formatMoney(tile.total)}` : `${tile.name}, ${state}`;
          return (
            <View key={tile.key} style={{ width: "31%", flexGrow: 1, minWidth: 96 }}>
              <Card
                onPress={() => onPick(tile)}
                accessibilityLabel={label}
                style={{
                  minHeight: 88,
                  justifyContent: "space-between",
                  padding: space[3],
                  backgroundColor: tile.state === "free" ? c.surfaceAlt : c.primarySoft,
                  borderColor: selected(tile) ? c.primary : c.line,
                  borderWidth: selected(tile) ? 2 : 1,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[1] }}>
                  <AppText variant="headline" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {tile.name}
                  </AppText>
                  {tile.ready > 0 ? (
                    <View style={{ minWidth: 24, height: 24, borderRadius: 12, backgroundColor: c.ok, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 }}>
                      <AppText variant="label" style={{ color: c.onPrimary, letterSpacing: 0 }}>
                        {tile.ready}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <View style={{ gap: 2 }}>
                  <AppText variant="label" tone={tile.state === "free" ? "ok" : "primary"}>
                    {state.toUpperCase()}
                  </AppText>
                  {tile.state === "occupied" ? (
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {formatMoney(tile.total)}
                      {tile.owner ? ` · ${tile.mine ? t("takeOrder.mine") : tile.owner}` : ""}
                    </AppText>
                  ) : null}
                </View>
              </Card>
            </View>
          );
        })}
      </View>
      <View style={{ gap: space[2] }}>
        <Field
          label={mode === "restaurant" ? t("takeOrder.takeoutName") : t("takeOrder.orderName")}
          value={name}
          onChangeText={setName}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Button
          label={mode === "restaurant" ? t("takeOrder.newTakeout") : t("takeOrder.newOrder")}
          icon="plus"
          variant="tonal"
          disabled={!name.trim()}
          loading={creating}
          onPress={submit}
        />
      </View>
    </View>
  );
}
