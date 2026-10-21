import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { t } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { radius, space, useTheme } from "@/theme";
import { ProductIconBadge } from "../product-icon";
import { AppText, Chip, Field } from "../ui";
import { categoryColor, filterMenu, type MenuCard, type MenuSection } from "./lib";

/** Menú de tarjetas por categoría, con buscador y chips de categoría (spec 018). Tocar una tarjeta agrega una unidad. */
export function MenuCards({
  menu,
  loading,
  disabled,
  countOf,
  onTap,
}: {
  menu: MenuSection[];
  loading: boolean;
  /** Sin orden elegida o cerrada: las tarjetas no agregan. */
  disabled: boolean;
  countOf: (card: MenuCard) => number;
  onTap: (card: MenuCard) => void;
}) {
  const { c } = useTheme();
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const sections = useMemo(() => filterMenu(menu, term).filter((s) => !category || s.category === category), [menu, term, category]);

  return (
    <View style={{ gap: space[3] }}>
      <Field label={t("menuPicker.search")} value={term} onChangeText={setTerm} icon="search" autoCapitalize="none" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
        <Chip label={t("common.all")} selected={category === null} onPress={() => setCategory(null)} />
        {menu.map((s) => (
          <Chip key={s.category} label={s.category} selected={category === s.category} onPress={() => setCategory(s.category)} />
        ))}
      </ScrollView>
      {!sections.length ? (
        <AppText tone="muted" style={{ textAlign: "center", padding: space[6] }}>
          {loading ? t("common.loading") : t("menuPicker.empty")}
        </AppText>
      ) : null}
      {sections.map((section) => (
        <View key={section.category} style={{ gap: space[2] }}>
          <AppText variant="label" tone="muted" accessibilityRole="header">
            {section.category.toUpperCase()}
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {section.items.map((card) => {
              const count = countOf(card);
              const off = !!card.sold_out || disabled;
              return (
                <View key={card.id} style={{ width: "48%", flexGrow: 1 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${card.name}, ${formatMoney(card.price)}${card.sold_out ? `, ${t("menuPicker.soldOut")}` : card.low ? `, ${t("menuPicker.low")}` : ""}${count ? `, ${t("takeOrder.inOrder", { count })}` : ""}`}
                    accessibilityState={{ disabled: off }}
                    disabled={off}
                    onPress={() => onTap(card)}
                    style={{
                      minHeight: 96,
                      borderRadius: radius.card,
                      borderWidth: count ? 2 : 1,
                      borderColor: count ? c.primary : c.line,
                      backgroundColor: c.surface,
                      padding: space[3],
                      gap: space[2],
                      justifyContent: "space-between",
                      opacity: off ? 0.5 : 1,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }}>
                      <ProductIconBadge product={card} color={categoryColor(section.category)} />
                      <AppText variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
                        {card.name}
                      </AppText>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <AppText variant="bodyStrong">{formatMoney(card.price)}</AppText>
                      {card.sold_out || card.low ? (
                        <AppText variant="label" tone={card.sold_out ? "stamp" : "muted"}>
                          {(card.sold_out ? t("menuPicker.soldOut") : t("menuPicker.low")).toUpperCase()}
                        </AppText>
                      ) : null}
                    </View>
                    {count > 0 ? (
                      <View style={{ position: "absolute", top: -8, right: -4, minWidth: 26, height: 26, borderRadius: 13, backgroundColor: c.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }}>
                        <AppText variant="label" style={{ color: c.onPrimary, letterSpacing: 0 }}>
                          {count}
                        </AppText>
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
