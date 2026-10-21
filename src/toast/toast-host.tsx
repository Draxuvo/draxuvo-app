import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AccessibilityInfo, PanResponder, Pressable, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText } from "@/components/ui";
import { getToast, subscribeToasts, toast, type ToastTone } from "./store";

/**
 * Dibuja el aviso actual arriba de la pantalla, sin mover el contenido (spec 022). Se monta una vez en el layout raíz.
 * Se cierra al tocarlo o al deslizarlo hacia arriba, y se anuncia a los lectores de pantalla.
 */
/**
 * `announce={false}` para una segunda copia dentro de un `Modal`: el modal tapa al host de la raíz, así que el aviso se
 * repite encima de él, pero solo una copia lo anuncia al lector de pantalla.
 */
export function ToastHost({ announce = true }: { announce?: boolean }) {
  const item = useSyncExternalStore(subscribeToasts, getToast, getToast);
  const { c } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (item && announce) void AccessibilityInfo.announceForAccessibility(item.text);
  }, [item, announce]);

  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy < -8 && Math.abs(g.dx) < 30,
        onPanResponderRelease: (_e, g) => {
          if (g.dy < -20) toast.dismiss();
        },
      }),
    [],
  );

  if (!item) return null;

  const tones: Record<ToastTone, { bg: string; fg: string; border: string; icon: keyof typeof Feather.glyphMap }> = {
    success: { bg: c.okSoft, fg: c.onOkSoft, border: c.ok, icon: "check-circle" },
    error: { bg: c.stampSoft, fg: c.onStampSoft, border: c.stamp, icon: "alert-circle" },
    info: { bg: c.primarySoft, fg: c.onPrimarySoft, border: c.primary, icon: "info" },
  };
  const tone = tones[item.tone];

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + space[2], paddingHorizontal: space[4], alignItems: "center", zIndex: 1000 }}>
      <Animated.View
        key={item.id}
        entering={FadeInUp.duration(180)}
        exiting={FadeOutUp.duration(160)}
        {...swipe.panHandlers}
        style={{ width: "100%", maxWidth: 520 }}
      >
        <Pressable
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={item.text}
          accessibilityHint={t("common.dismissNotice")}
          testID={`toast-${item.tone}`}
          onPress={() => toast.dismiss()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
            minHeight: 52,
            paddingVertical: space[3],
            paddingHorizontal: space[4],
            borderRadius: radius.card,
            backgroundColor: tone.bg,
            borderWidth: 1.5,
            borderColor: tone.border,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          <Feather name={tone.icon} size={20} color={tone.fg} />
          <AppText variant="bodyStrong" numberOfLines={4} style={{ flex: 1, color: tone.fg }}>
            {item.text}
          </AppText>
        </Pressable>
      </Animated.View>
    </View>
  );
}
