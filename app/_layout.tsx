import * as Sentry from "@sentry/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RestaurantAlertsHost } from "@/components/restaurant-alerts-host";
import { AppGate } from "@/gates/app-gate";
import { ToastHost } from "@/toast/toast-host";
import { loadLocale } from "@/i18n";
import { initMonitoring, isMonitoringActive, setMonitoringScreen } from "@/lib/monitoring";
import { PushHost } from "@/push/host";
import { createQueryClient } from "@/query/client";
import { SessionProvider } from "@/session";
import { fontFamily, useTheme } from "@/theme";
import { useAppFonts } from "@/theme/fonts";

void SplashScreen.preventAutoHideAsync().catch(() => {});
// Spec 071: lo antes posible (sin EXPO_PUBLIC_SENTRY_DSN no hace nada).
initMonitoring();

function Screens() {
  const { c } = useTheme();
  const pathname = usePathname();
  useEffect(() => setMonitoringScreen(pathname), [pathname]);
  const pushed = {
    headerShown: true,
    headerStyle: { backgroundColor: c.background },
    headerShadowVisible: false,
    headerTintColor: c.ink,
    headerTitleStyle: { fontFamily: fontFamily.displayBold, fontSize: 20 },
    animation: "slide_from_right",
  } as const;
  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: c.background } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="actualizar" />
        <Stack.Screen name="empresa" options={{ ...pushed, presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen name="cobro/[id]" options={pushed} />
        <Stack.Screen name="pedido" options={pushed} />
        <Stack.Screen name="asistencia-equipo" options={pushed} />
        <Stack.Screen name="cuenta/[id]" options={pushed} />
        <Stack.Screen name="ticket/[id]" options={pushed} />
        <Stack.Screen name="orden-form/[id]" options={pushed} />
      </Stack>
      <RestaurantAlertsHost />
      <PushHost />
      <ToastHost />
    </>
  );
}

function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const fontsReady = useAppFonts();

  useEffect(() => {
    void loadLocale();
  }, []);
  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider onSignedOut={() => queryClient.clear()}>
            <StatusBar style="auto" />
            <AppGate>
              <Screens />
            </AppGate>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Spec 071: con DSN, Sentry envuelve la raíz para atrapar los errores de render; sin DSN, la raíz queda tal cual.
export default isMonitoringActive() ? Sentry.wrap(RootLayout) : RootLayout;
