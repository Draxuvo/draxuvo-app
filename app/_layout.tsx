import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ReadyAlertsHost } from "@/components/ready-alerts-host";
import { AppGate } from "@/gates/app-gate";
import { ToastHost } from "@/toast/toast-host";
import { loadLocale } from "@/i18n";
import { createQueryClient } from "@/query/client";
import { SessionProvider } from "@/session";
import { fontFamily, useTheme } from "@/theme";
import { useAppFonts } from "@/theme/fonts";

void SplashScreen.preventAutoHideAsync().catch(() => {});

function Screens() {
  const { c } = useTheme();
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
      <ReadyAlertsHost />
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
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
