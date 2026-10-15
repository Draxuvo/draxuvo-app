import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { duration, ease, useTheme } from "@/theme";

function Segment({ filled, color, track }: { filled: boolean; color: string; track: string }) {
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    fill.set(withTiming(filled ? 1 : 0, { duration: duration.base, easing: ease }));
  }, [filled, fill]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  return (
    <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: track, overflow: "hidden" }}>
      <Animated.View style={[{ flex: 1, backgroundColor: color, transformOrigin: "left" }, style]} />
    </View>
  );
}

/** Avance en pasos: un segmento por paso (hasta 12), o una barra continua si son muchos. */
export function StepsBar({ done, total, complete }: { done: number; total: number; complete?: boolean }) {
  const { c } = useTheme();
  const color = complete || (total > 0 && done >= total) ? c.ok : c.primary;
  if (total <= 0) return null;
  const count = Math.min(total, 12);
  const filled = total <= 12 ? done : Math.round((done / total) * count);
  return (
    <View style={{ flexDirection: "row", gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, i) => (
        <Segment key={i} filled={i < filled} color={color} track={c.surfaceAlt} />
      ))}
    </View>
  );
}
