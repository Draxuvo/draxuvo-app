import { Feather } from "@expo/vector-icons";
import { useEffect, type ComponentProps, type ReactNode, type Ref } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { haptic } from "@/lib/haptics";
import { duration, ease, MIN_TOUCH, radius, space, typeScale, useTheme, type TypeRole } from "@/theme";

export type IconName = ComponentProps<typeof Feather>["name"];
export type Tone = "ink" | "muted" | "primary" | "stamp" | "ok" | "onPrimary";

export function AppText({
  variant = "body",
  tone = "ink",
  children,
  ...rest
}: { variant?: TypeRole; tone?: Tone; children?: ReactNode } & ComponentProps<typeof Text>) {
  const { c } = useTheme();
  const color = { ink: c.ink, muted: c.inkMuted, primary: c.primary, stamp: c.stamp, ok: c.ok, onPrimary: c.onPrimary }[tone];
  return (
    <Text {...rest} style={[typeScale[variant] as object, { color }, rest.style]}>
      {children}
    </Text>
  );
}

/** Levanta el contenido sobre el teclado; en Android de borde a borde el sistema ya no redimensiona la ventana. */
export function KeyboardFrame({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      {children}
    </KeyboardAvoidingView>
  );
}

export function Icon({ name, size = 22, tone = "ink" }: { name: IconName; size?: number; tone?: Tone }) {
  const { c } = useTheme();
  const color = { ink: c.ink, muted: c.inkMuted, primary: c.primary, stamp: c.stamp, ok: c.ok, onPrimary: c.onPrimary }[tone];
  return <Feather name={name} size={size} color={color} />;
}

/** Respuesta de presión compartida: la pieza se hunde un poco y vuelve con un resorte corto. */
export function usePressScale(to = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => scale.set(withTiming(to, { duration: 90 })),
    onPressOut: () => scale.set(withSpring(1, { damping: 14, stiffness: 260 })),
  };
}

type ButtonVariant = "primary" | "tonal" | "outline" | "text" | "danger";

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const press = usePressScale();
  const inactive = disabled || loading;
  const look = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    tonal: { bg: c.primarySoft, fg: c.onPrimarySoft, border: c.primarySoft },
    outline: { bg: "transparent", fg: c.ink, border: c.line },
    text: { bg: "transparent", fg: c.primary, border: "transparent" },
    danger: { bg: c.stampSoft, fg: c.onStampSoft, border: c.stampSoft },
  }[variant];

  return (
    <Animated.View style={[press.style, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        disabled={inactive}
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        android_ripple={{ color: c.scrim, borderless: false }}
        style={{
          minHeight: 52,
          paddingHorizontal: space[5],
          borderRadius: radius.field,
          backgroundColor: look.bg,
          borderWidth: 1.5,
          borderColor: look.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space[2],
          opacity: inactive && !loading ? 0.45 : 1,
          overflow: "hidden",
        }}
      >
        {loading ? <ActivityIndicator color={look.fg} /> : icon ? <Feather name={icon} size={20} color={look.fg} /> : null}
        {loading ? null : (
          <Text style={[typeScale.bodyStrong as object, { color: look.fg, fontSize: 16 }]} numberOfLines={1}>
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone = "ink",
  badge,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: Tone;
  badge?: number;
}) {
  const { c } = useTheme();
  const press = usePressScale(0.9);
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{ width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name={icon} tone={tone} />
        {badge ? (
          <View
            style={{
              position: "absolute",
              top: 6,
              right: 4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 4,
              backgroundColor: c.marker,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[typeScale.label as object, { color: c.onMarker, fontSize: 11, letterSpacing: 0 }]}>{badge}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  role = "button",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  role?: "button" | "radio";
}) {
  const { c } = useTheme();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(selected ? 1 : 0, { duration: duration.base, easing: ease }));
  }, [selected, progress]);
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [c.surface, c.ink]),
    borderColor: interpolateColor(progress.value, [0, 1], [c.line, c.ink]),
  }));
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={4}
      onPress={() => {
        haptic.select();
        onPress();
      }}
    >
      <Animated.View
        style={[
          {
            minHeight: 40,
            paddingHorizontal: space[4],
            borderRadius: radius.pill,
            borderWidth: 1.5,
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
          },
          bg,
        ]}
      >
        {icon ? <Feather name={icon} size={16} color={selected ? c.background : c.ink} /> : null}
        <Text style={[typeScale.bodyStrong as object, { color: selected ? c.background : c.ink }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  icon,
  inputRef,
  ...input
}: { label: string; error?: string | null; icon?: IconName; inputRef?: Ref<TextInput> } & TextInputProps) {
  const { c } = useTheme();
  const focus = useSharedValue(0);
  const ring = useAnimatedStyle(() => ({
    borderColor: error ? c.stamp : interpolateColor(focus.value, [0, 1], [c.line, c.primary]),
  }));
  return (
    <View style={{ gap: space[1] }}>
      <AppText variant="label" tone="muted">
        {label.toUpperCase()}
      </AppText>
      <Animated.View
        style={[
          {
            minHeight: 54,
            borderRadius: radius.field,
            borderWidth: 2,
            backgroundColor: input.editable === false ? c.surfaceAlt : c.surface,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: space[4],
            gap: space[2],
          },
          ring,
        ]}
      >
        {icon ? <Feather name={icon} size={18} color={c.inkMuted} /> : null}
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={c.inkMuted}
          selectionColor={c.primary}
          {...input}
          onFocus={(event) => {
            focus.set(withTiming(1, { duration: duration.quick }));
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            focus.set(withTiming(0, { duration: duration.quick }));
            input.onBlur?.(event);
          }}
          style={[
            typeScale.bodyLarge as object,
            { flex: 1, color: input.editable === false ? c.inkMuted : c.ink, paddingVertical: space[3] } as object,
            Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
            input.style,
          ]}
        />
      </Animated.View>
      {error ? (
        <AppText variant="label" tone="stamp" accessibilityLiveRegion="polite" style={{ letterSpacing: 0.2 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const press = usePressScale(0.985);
  const base: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.line,
    padding: space[4],
    gap: space[2],
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[base, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line }} />;
}

/** Control segmentado con una pieza deslizante; cada opción se anuncia como botón seleccionable. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  const { c } = useTheme();
  const width = useSharedValue(0);
  const index = useSharedValue(Math.max(0, options.findIndex((o) => o.value === value)));
  useEffect(() => {
    const next = options.findIndex((o) => o.value === value);
    if (next >= 0) index.set(withSpring(next, { damping: 18, stiffness: 240 }));
  }, [value, options, index]);
  const thumb = useAnimatedStyle(() => {
    const w = (width.value - 8) / options.length;
    return { width: w, transform: [{ translateX: index.value * w }], opacity: value === null ? 0 : 1 };
  });
  return (
    <View
      onLayout={(event) => width.set(event.nativeEvent.layout.width)}
      style={{ flexDirection: "row", padding: 4, borderRadius: radius.field + 4, backgroundColor: c.surfaceAlt }}
    >
      <Animated.View style={[{ position: "absolute", top: 4, left: 4, bottom: 4, borderRadius: radius.field, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, thumb]} />
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: option.value === value }}
          onPress={() => {
            if (option.value !== value) haptic.select();
            onChange(option.value);
          }}
          style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: space[2] }}
        >
          <Text style={[typeScale.bodyStrong as object, { color: option.value === value ? c.ink : c.inkMuted }]}>{option.label}</Text>
          {option.count ? (
            <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: option.value === value ? c.marker : c.line, alignItems: "center", justifyContent: "center" }}>
              <Text style={[typeScale.label as object, { color: option.value === value ? c.onMarker : c.inkMuted, letterSpacing: 0, fontSize: 12 }]}>{option.count}</Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
