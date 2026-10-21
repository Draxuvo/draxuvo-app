import { Feather } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { haptic } from "@/lib/haptics";
import { MIN_TOUCH, radius, useTheme } from "@/theme";

/**
 * Botón de más o menos con icono (no con texto): una etiqueta "+" o "−" no cabe en un botón angosto con letra grande y
 * se cortaba como "…". Mide al menos 48 dp y lleva nombre para lectores de pantalla.
 */
export function QtyButton({ kind, label, disabled, onPress }: { kind: "plus" | "minus"; label: string; disabled?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: MIN_TOUCH,
        height: MIN_TOUCH,
        borderRadius: radius.field,
        borderWidth: 1.5,
        borderColor: c.line,
        backgroundColor: pressed ? c.surfaceAlt : c.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Feather name={kind} size={22} color={c.ink} />
    </Pressable>
  );
}
