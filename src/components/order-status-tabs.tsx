import { Pressable, ScrollView, View } from "react-native";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText } from "./ui";

export type StatusTab = "open" | "in_progress" | "done" | "paid";

export const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "open", label: "orders.tabs.todo" },
  { value: "in_progress", label: "orders.tabs.progress" },
  { value: "done", label: "orders.tabs.done" },
  { value: "paid", label: "orders.tabs.paid" },
];

/** Pestañas de estado con contador (spec 023): Pendientes, En curso, Terminadas y Cobradas; sin selección cuando se ve Canceladas. */
export function OrderStatusTabs({
  value,
  onChange,
  counts,
}: {
  value: StatusTab | null;
  onChange: (tab: StatusTab) => void;
  counts: Record<StatusTab, number>;
}) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4] }} accessibilityRole="tablist">
      {STATUS_TABS.map((tab) => {
        const selected = value === tab.value;
        const count = counts[tab.value];
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityLabel={`${t(tab.label)}, ${count}`}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) haptic.select();
              onChange(tab.value);
            }}
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              gap: space[2],
              paddingHorizontal: space[4],
              borderRadius: radius.pill,
              borderWidth: 1.5,
              borderColor: selected ? c.ink : c.line,
              backgroundColor: selected ? c.ink : c.surface,
            }}
          >
            <AppText variant="bodyStrong" style={{ color: selected ? c.surface : c.ink }}>
              {t(tab.label)}
            </AppText>
            <View
              style={{
                minWidth: 24,
                height: 24,
                borderRadius: 12,
                paddingHorizontal: 6,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected ? c.marker : c.surfaceAlt,
              }}
            >
              <AppText variant="label" style={{ color: selected ? c.onMarker : c.inkMuted, letterSpacing: 0, fontSize: 12 }}>
                {count}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
