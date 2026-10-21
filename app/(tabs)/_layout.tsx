import { Tabs } from "expo-router";
import { View } from "react-native";
import { AppHeader } from "@/components/app-header";
import { DrawerMenu } from "@/components/drawer-menu";
import { DrawerProvider } from "@/components/drawer-context";
import { TabBar, type TabBarProps } from "@/components/tab-bar";
import { useOutboxSync } from "@/hooks/use-outbox";
import { t, useLocale } from "@/i18n";

export default function TabsLayout() {
  useLocale();
  useOutboxSync();

  return (
    <DrawerProvider>
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
          screenOptions={{ header: ({ options }) => <AppHeader title={String(options.title ?? "")} /> }}
        >
          <Tabs.Screen name="ordenes/index" options={{ title: t("tabs.orders") }} />
          <Tabs.Screen name="ordenes/[id]" options={{ href: null, headerShown: false }} />
          <Tabs.Screen name="tickets" options={{ title: t("tabs.tickets") }} />
          <Tabs.Screen name="perfil" options={{ title: t("tabs.profile") }} />
        </Tabs>
        <DrawerMenu />
      </View>
    </DrawerProvider>
  );
}
