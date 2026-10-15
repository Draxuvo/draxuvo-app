import { useEffect } from "react";
import { View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { radius, space, useTheme } from "@/theme";

/** Bloque que respira mientras carga; con "quitar animaciones" queda fijo. */
export function SkeletonBlock({ width = "100%", height = 16, style }: { width?: DimensionValue; height?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.55);
  useEffect(() => {
    if (reduced) return;
    pulse.set(withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [pulse, reduced]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ width, height, borderRadius: 8, backgroundColor: c.surfaceAlt }, animated, style]} />;
}

/** Imita la forma de una tarjeta de orden para que la lista no salte al cargar. */
export function OrderCardSkeleton() {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: "row", backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, overflow: "hidden" }}
    >
      <View style={{ width: 64, backgroundColor: c.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
        <SkeletonBlock width={34} height={22} style={{ backgroundColor: c.line }} />
      </View>
      <View style={{ flex: 1, padding: space[4], gap: space[3] }}>
        <SkeletonBlock width="70%" height={20} />
        <SkeletonBlock width="40%" height={14} />
        <SkeletonBlock width="100%" height={8} />
      </View>
    </View>
  );
}

export function OrderListSkeleton() {
  return (
    <View style={{ gap: space[3], padding: space[4] }}>
      {[0, 1, 2, 3].map((i) => (
        <OrderCardSkeleton key={i} />
      ))}
    </View>
  );
}
