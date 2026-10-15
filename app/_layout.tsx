import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppGate } from "@/gates/app-gate";
import { loadLocale } from "@/i18n";
import { createQueryClient } from "@/query/client";
import { SessionProvider } from "@/session";

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);

  useEffect(() => {
    void loadLocale();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider onSignedOut={() => queryClient.clear()}>
        <StatusBar style="dark" />
        <AppGate>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="actualizar" />
            <Stack.Screen name="empresa" options={{ presentation: "modal", headerShown: true }} />
            <Stack.Screen name="cobro/[id]" options={{ headerShown: true }} />
            <Stack.Screen name="ticket/[id]" options={{ headerShown: true }} />
            <Stack.Screen name="orden-form/[id]" options={{ headerShown: true }} />
          </Stack>
        </AppGate>
      </SessionProvider>
    </QueryClientProvider>
  );
}
