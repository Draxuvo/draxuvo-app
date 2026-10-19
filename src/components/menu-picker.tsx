import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, View } from "react-native";
import type { MenuGroup, MenuProduct } from "@/api/types";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText, Button, Chip, Field, IconButton, KeyboardFrame } from "./ui";

/** Menú por categoría. Un producto agotado no se puede elegir; uno con pocas existencias lo avisa (FR-040, FR-041). */
export function MenuPicker({
  visible,
  menu,
  loading,
  busy,
  onAdd,
  onClose,
}: {
  visible: boolean;
  menu: MenuGroup[];
  loading?: boolean;
  busy?: boolean;
  onAdd: (product: MenuProduct, quantity: number, note?: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<MenuProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return menu
      .filter((group) => !category || group.category === category)
      .flatMap((group) => group.items)
      .filter((item) => !term || item.name.toLowerCase().includes(term));
  }, [menu, search, category]);

  const maxQuantity = selected?.available_qty ?? Infinity;

  const choose = (product: MenuProduct) => {
    if (product.sold_out) return;
    setSelected(product);
    setQuantity(1);
    setNote("");
  };

  const add = async () => {
    if (!selected) return;
    await onAdd(selected, quantity, note.trim() || undefined);
    setSelected(null);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardFrame>
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: space[10] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[4] }}>
            <AppText variant="headline" accessibilityRole="header">
              {t("menuPicker.title")}
            </AppText>
            <IconButton icon="x" label={t("common.close")} onPress={onClose} />
          </View>
          <View style={{ paddingHorizontal: space[4], paddingTop: space[3], gap: space[3] }}>
            <Field label={t("menuPicker.search")} value={search} onChangeText={setSearch} icon="search" autoCapitalize="none" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
              <Chip label={t("common.all")} selected={category === null} onPress={() => setCategory(null)} />
              {menu.map((group) => (
                <Chip key={group.category} label={group.category} selected={category === group.category} onPress={() => setCategory(group.category)} />
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={products}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: space[4], gap: space[2] }}
            ListEmptyComponent={
              <AppText tone="muted" style={{ textAlign: "center", padding: space[6] }}>
                {loading ? t("common.loading") : t("menuPicker.empty")}
              </AppText>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, $${Number(item.price).toFixed(2)}${item.sold_out ? `, ${t("menuPicker.soldOut")}` : item.low ? `, ${t("menuPicker.low")}` : ""}`}
                accessibilityState={{ disabled: !!item.sold_out, selected: selected?.id === item.id }}
                disabled={!!item.sold_out}
                onPress={() => choose(item)}
                style={{
                  minHeight: 64,
                  borderRadius: radius.card,
                  borderWidth: selected?.id === item.id ? 2 : 1,
                  borderColor: selected?.id === item.id ? c.primary : c.line,
                  backgroundColor: c.surface,
                  padding: space[3],
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: space[3],
                  opacity: item.sold_out ? 0.5 : 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{item.name}</AppText>
                  {item.sold_out || item.low ? (
                    <AppText variant="label" tone={item.sold_out ? "stamp" : "muted"}>
                      {(item.sold_out ? t("menuPicker.soldOut") : t("menuPicker.low")).toUpperCase()}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="bodyStrong">${Number(item.price).toFixed(2)}</AppText>
              </Pressable>
            )}
          />

          {selected ? (
            <View style={{ padding: space[4], gap: space[3], borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.surface }}>
              <AppText variant="title">{selected.name}</AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
                <Button label="−" variant="outline" disabled={quantity <= 1} onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={{ width: 56 }} />
                <AppText variant="figure" accessibilityLabel={`${t("check.quantity")} ${quantity}`}>
                  {quantity}
                </AppText>
                <Button label="+" variant="outline" disabled={quantity >= maxQuantity} onPress={() => setQuantity((q) => q + 1)} style={{ width: 56 }} />
              </View>
              <Field label={t("check.note")} value={note} onChangeText={setNote} placeholder={t("check.notePlaceholder")} />
              <Button label={t("menuPicker.add")} icon="plus" loading={busy} onPress={() => void add()} />
            </View>
          ) : null}
        </View>
      </KeyboardFrame>
    </Modal>
  );
}
