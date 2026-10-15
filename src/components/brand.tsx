import Svg, { Circle, Path, Rect } from "react-native-svg";
import { View } from "react-native";
import { AppText } from "./ui";
import { space, useTheme } from "@/theme";

/** Marca: hoja de servicio con muesca a la izquierda y una "D". Provisional, como el resto de la marca. */
export function BrandMark({ size = 44 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 44 44">
      <Rect width="44" height="44" rx="12" fill={c.primary} />
      <Circle cx="0" cy="22" r="6" fill={c.background} />
      <Path d="M17 12h6.5c5.3 0 9 3.6 9 10s-3.7 10-9 10H17V12Zm4.4 3.8v12.4h2c3 0 4.9-2.2 4.9-6.2s-1.9-6.2-4.9-6.2h-2Z" fill={c.onPrimary} />
      <Rect x="17" y="35" width="15" height="3" rx="1.5" fill={c.marker} />
    </Svg>
    </View>
  );
}

export function BrandLockup({ size = 44 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
      <BrandMark size={size} />
      <AppText variant="headline">Draxuvo</AppText>
    </View>
  );
}
