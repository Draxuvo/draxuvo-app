import { Pressable, Text } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptic } from "@/lib/haptics";
import { duration, ease, radius, space, TAB_BAR_HEIGHT, typeScale, useTheme } from "@/theme";
import { Icon, usePressScale, type IconName } from "./ui";

const EXTENDED = 176;
const COLLAPSED = 60;

/** Botón flotante extendido: muestra su texto arriba de la lista y se encoge a solo ícono al bajar. */
export function Fab({ label, icon, extended, onPress }: { label: string; icon: IconName; extended: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const press = usePressScale(0.94);
  const width = useAnimatedStyle(() => ({ width: withTiming(extended ? EXTENDED : COLLAPSED, { duration: duration.base, easing: ease }) }));
  const text = useAnimatedStyle(() => ({ opacity: withTiming(extended ? 1 : 0, { duration: duration.quick }) }));
  return (
    <Animated.View style={[{ position: "absolute", right: space[4], bottom: TAB_BAR_HEIGHT + insets.bottom + space[4] }, press.style]}>
      <Animated.View
        style={[
          {
            height: COLLAPSED,
            borderRadius: radius.card,
            backgroundColor: c.marker,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.22,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          },
          width,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            haptic.tap();
            onPress();
          }}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: space[2] }}
        >
          <Icon name={icon} size={24} />
          <Animated.View style={text} pointerEvents="none">
            <Text style={[typeScale.bodyStrong as object, { color: c.onMarker, fontSize: 16 }]} numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
