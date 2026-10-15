import { View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";
import { useTheme } from "@/theme";

// Geometría vectorial hecha a mano con los colores del tema: una hoja de servicio y un sello.
type ArtProps = { size?: number };

/** Decoración: los lectores de pantalla la saltan. */
function Hidden({ children }: { children: React.ReactNode }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {children}
    </View>
  );
}

function Sheet({ size = 160, children }: ArtProps & { children?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Hidden><Svg width={size} height={size} viewBox="0 0 160 160">
      <Rect x="38" y="20" width="84" height="116" rx="8" fill={c.surface} stroke={c.line} strokeWidth="2" />
      <Rect x="38" y="20" width="84" height="20" rx="8" fill={c.primarySoft} />
      <Rect x="38" y="32" width="84" height="8" fill={c.primarySoft} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Circle key={i} cx={52 + i * 14} cy="30" r="2.5" fill={c.background} />
      ))}
      {children}
    </Svg></Hidden>
  );
}

/** Sin órdenes por hacer: hoja en blanco con un renglón resaltado. */
export function EmptyOrdersArt({ size = 160 }: ArtProps) {
  const { c } = useTheme();
  return (
    <Sheet size={size}>
      <Rect x="50" y="56" width="52" height="10" rx="3" fill={c.marker} />
      <Line x1="50" y1="61" x2="96" y2="61" stroke={c.ink} strokeWidth="3" strokeLinecap="round" />
      {[80, 98, 116].map((y) => (
        <Line key={y} x1="50" y1={y} x2={y === 98 ? 86 : 110} y2={y} stroke={c.line} strokeWidth="3" strokeLinecap="round" />
      ))}
      <G rotation="-12" origin="116, 122">
        <Circle cx="116" cy="122" r="22" fill="none" stroke={c.ok} strokeWidth="3" />
        <Path d="M106 122 l7 7 l13 -15" fill="none" stroke={c.ok} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Sheet>
  );
}

/** Sin tickets: recibo con el borde en zigzag. */
export function EmptyTicketsArt({ size = 160 }: ArtProps) {
  const { c } = useTheme();
  return (
    <Hidden><Svg width={size} height={size} viewBox="0 0 160 160">
      <Path d="M44 20 H116 V132 L108 124 L100 132 L92 124 L84 132 L76 124 L68 132 L60 124 L52 132 L44 124 Z" fill={c.surface} stroke={c.line} strokeWidth="2" strokeLinejoin="round" />
      <Rect x="56" y="34" width="30" height="8" rx="3" fill={c.ink} />
      {[56, 72, 88].map((y) => (
        <G key={y}>
          <Line x1="56" y1={y} x2="84" y2={y} stroke={c.line} strokeWidth="3" strokeLinecap="round" />
          <Line x1="96" y1={y} x2="104" y2={y} stroke={c.line} strokeWidth="3" strokeLinecap="round" />
        </G>
      ))}
      <Rect x="56" y="100" width="48" height="12" rx="3" fill={c.marker} />
    </Svg></Hidden>
  );
}

/** Sin conexión o error: la hoja con una raya de sello rojo. */
export function ProblemArt({ size = 160 }: ArtProps) {
  const { c } = useTheme();
  return (
    <Sheet size={size}>
      {[58, 76, 94].map((y) => (
        <Line key={y} x1="50" y1={y} x2={y === 76 ? 88 : 108} y2={y} stroke={c.line} strokeWidth="3" strokeLinecap="round" />
      ))}
      <G rotation="-14" origin="104, 112">
        <Rect x="70" y="98" width="68" height="28" rx="6" fill="none" stroke={c.stamp} strokeWidth="3" />
        <Line x1="80" y1="112" x2="128" y2="112" stroke={c.stamp} strokeWidth="4" strokeLinecap="round" />
      </G>
    </Sheet>
  );
}
