import { View } from "react-native";
import { t } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { space, useTheme } from "@/theme";
import { AppText, Button, Card, Field, Segmented } from "../ui";
import { useState } from "react";
import type { Selection, SourceTile } from "./use-order-source";

function minutesOpen(iso: string | null | undefined): number | null {
  return iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)) : null;
}

/** `12 min` o `1 h 05 min`. */
export function formatOpen(minutes: number): string {
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

type Scope = "all" | "mine";

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
  const [scope, setScope] = useState<Scope>("all");
  // "Mis mesas": las cuentas propias y las mesas libres, que son las que se pueden abrir (spec 032).
  const filterable = mode === "restaurant";
  const visible = filterable && scope === "mine" ? tiles.filter((tile) => tile.mine || tile.state === "free") : tiles;
  const noneMine = filterable && scope === "mine" && !tiles.some((tile) => tile.mine);
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
      {filterable ? (
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: "all", label: t("takeOrder.scopeAll") },
            { value: "mine", label: t("takeOrder.scopeMine") },
          ]}
        />
      ) : null}
      {noneMine ? <AppText tone="muted">{t("takeOrder.noMine")}</AppText> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {visible.map((tile) => {
          const state = t(`takeOrder.state.${tile.state}`);
          const minutes = tile.state === "free" ? null : minutesOpen(tile.openedAt);
          const label = [tile.name, state, minutes != null ? t("takeOrder.openFor", { time: formatOpen(minutes) }) : null, tile.state !== "free" && tile.total != null ? formatMoney(tile.total) : null]
            .filter(Boolean)
            .join(", ");
          return (
            <View key={tile.key} style={{ width: "31%", flexGrow: 1, minWidth: 96 }}>
              <Card
                onPress={() => onPick(tile)}
                accessibilityLabel={label}
                style={{
                  minHeight: 88,
                  justifyContent: "space-between",
                  padding: space[3],
                  backgroundColor: tile.state === "free" ? c.surfaceAlt : tile.state === "to_pay" ? c.marker : c.primarySoft,
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
                  <AppText variant="label" tone={tile.state === "free" ? "ok" : tile.state === "to_pay" ? undefined : "primary"} style={tile.state === "to_pay" ? { color: c.onMarker } : undefined}>
                    {state.toUpperCase()}
                  </AppText>
                  {tile.state !== "free" ? (
                    <AppText variant="bodyStrong" numberOfLines={1} style={tile.state === "to_pay" ? { color: c.onMarker } : undefined}>
                      {[tile.total != null ? formatMoney(tile.total) : null, minutes != null ? formatOpen(minutes) : null].filter(Boolean).join(" · ")}
                    </AppText>
                  ) : null}
                  {tile.state !== "free" && tile.owner ? (
                    <AppText variant="label" tone="muted" numberOfLines={1} style={tile.state === "to_pay" ? { color: c.onMarker } : undefined}>
                      {tile.mine ? t("takeOrder.mine") : tile.owner}
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
