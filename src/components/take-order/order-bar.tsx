import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "@/i18n";
import { formatMoney } from "@/lib/money";
import { radius, space, useTheme } from "@/theme";
import { AppText, Icon } from "../ui";

/**
 * Barra fija del menú (spec 024): "Orden · N productos · $total" o "Orden vacía". Siempre se puede tocar: abre la
 * orden en una hoja, que con la orden vacía solo ofrece Liberar mesa. El total hace una escala breve al cambiar.
 */
export function OrderBar({ count, total, onPress }: { count: number; total: number; onPress: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const bump = useSharedValue(1);
  useEffect(() => {
    bump.set(withSequence(withTiming(1.08, { duration: 90 }), withTiming(1, { duration: 140 })));
  }, [count, total, bump]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

  const money = formatMoney(total);
  const label = count === 0 ? t("takeOrder.orderBarEmpty") : count === 1 ? t("takeOrder.orderBarOne", { total: money }) : t("takeOrder.orderBar", { count, total: money });

  return (
    <View style={{ paddingBottom: insets.bottom, paddingHorizontal: space[4], paddingTop: space[2], backgroundColor: c.background, borderTopWidth: 1, borderTopColor: c.line }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t("takeOrder.openOrder")}, ${label}`}
        testID="order-bar"
        onPress={onPress}
        style={{ minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[3], paddingHorizontal: space[4], borderRadius: radius.card, backgroundColor: c.primary }}
      >
        <Animated.View style={animated}>
          <AppText variant="bodyStrong" style={{ color: c.onPrimary }}>
            {label}
          </AppText>
        </Animated.View>
        <Icon name="chevron-up" tone="onPrimary" />
      </Pressable>
    </View>
  );
}
