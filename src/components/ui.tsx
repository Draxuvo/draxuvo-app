import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, etiquetaShadow, MIN_TOUCH, radii, spacing, typography } from "@/theme";

type Variant = keyof typeof typography;

export function AppText({
  variant = "body",
  muted,
  children,
  ...rest
}: { variant?: Variant; muted?: boolean; children?: ReactNode } & React.ComponentProps<typeof Text>) {
  return (
    <Text {...rest} style={[typography[variant] as object, { color: muted ? colors.grisTexto : colors.tinta }, rest.style]}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" ? styles.primary : styles.outline,
        pressed && { opacity: 0.85 },
        inactive && { opacity: 0.5 },
      ]}
    >
      {loading ? <ActivityIndicator color={colors.tinta} /> : <AppText variant="bodyStrong">{label}</AppText>}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...input
}: { label: string; error?: string | null } & TextInputProps) {
  return (
    <View style={{ gap: spacing[1] }}>
      <AppText variant="label" muted>
        {label.toUpperCase()}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.graficaNeutra}
        {...input}
        style={[styles.input, error ? { borderColor: colors.alerta } : null, input.style]}
      />
      {error ? (
        <AppText variant="label" style={{ color: colors.alerta }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function Card({ children, onPress, accessibilityLabel }: { children: ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  if (!onPress) return <View style={styles.card}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={styles.card}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing[4],
    borderRadius: radii.etiqueta,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.oferta },
  outline: { borderWidth: 1.5, borderColor: colors.tinta, backgroundColor: "transparent" },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1.5,
    borderColor: colors.anaquelBorde,
    borderRadius: radii.etiqueta,
    backgroundColor: colors.etiqueta,
    paddingHorizontal: spacing[3],
    fontSize: 16,
    color: colors.tinta,
  },
  card: {
    backgroundColor: colors.etiqueta,
    borderRadius: radii.etiqueta,
    padding: spacing[4],
    gap: spacing[2],
    ...etiquetaShadow,
  },
});
