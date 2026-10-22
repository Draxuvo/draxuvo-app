import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOutbox } from "@/hooks/use-outbox";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { useScreenModeState } from "./take-order/use-screen-mode";
import { radius, space, TAB_BAR_HEIGHT, useTheme } from "@/theme";
import { AppText, Icon, type IconName } from "./ui";

/** Lo mínimo que la barra usa del navegador de pestañas (evita depender de sus tipos internos). */
export interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

const TABS: { route: string; icon: IconName; label: string }[] = [
  { route: "ordenes/index", icon: "clipboard", label: "tabs.orders" },
  { route: "tickets", icon: "file-text", label: "tabs.tickets" },
  { route: "perfil", icon: "user", label: "tabs.profile" },
];

function TabItem({ icon, label, focused, badge, onPress }: { icon: IconName; label: string; focused: boolean; badge?: number; onPress: () => void }) {
  const { c } = useTheme();
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220 }));
  }, [focused, on]);
  const pill = useAnimatedStyle(() => ({ opacity: on.value, transform: [{ scaleX: 0.4 + on.value * 0.6 }] }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * on.value }] }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={() => {
        if (!focused) haptic.select();
        onPress();
      }}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space[1], minHeight: 56 }}
    >
      <Animated.View style={lift}>
        <View style={{ width: 64, height: 32, alignItems: "center", justifyContent: "center" }}>
          <Animated.View style={[{ position: "absolute", width: 64, height: 32, borderRadius: radius.pill, backgroundColor: c.marker }, pill]} />
          <Icon name={icon} tone={focused ? "ink" : "muted"} />
          {badge ? (
            <View style={{ position: "absolute", top: -2, right: 8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.stamp, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}>
              <AppText variant="label" style={{ color: "#FFFFFF", fontSize: 10, letterSpacing: 0, lineHeight: 12 }}>
                {badge}
              </AppText>
            </View>
          ) : null}
        </View>
      </Animated.View>
      <AppText variant="label" tone={focused ? "ink" : "muted"} style={{ letterSpacing: 0.2 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Barra inferior de tres destinos. En el detalle de una orden se esconde: ahí manda la barra de acciones. */
export function TabBar({ state, navigation }: TabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pending = useOutbox().filter((item) => item.state === "pending" || item.state === "sending").length;
  // Con mesas dadas de alta la lista de órdenes se llama Cuentas (spec 032).
  const { mode } = useScreenModeState();
  const current = state.routes[state.index]?.name;
  if (!TABS.some((tab) => tab.route === current)) return null;

  return (
    <View
      style={{
        height: TAB_BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: "row",
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.line,
        paddingHorizontal: space[2],
      }}
    >
      {TABS.map((tab) => {
        const route = state.routes.find((item) => item.name === tab.route);
        if (!route) return null;
        const focused = current === tab.route;
        return (
          <TabItem
            key={tab.route}
            icon={tab.icon}
            label={tab.route === "ordenes/index" && mode === "restaurant" ? t("tabs.accounts") : t(tab.label)}
            focused={focused}
            badge={tab.route === "ordenes/index" ? pending : undefined}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}
