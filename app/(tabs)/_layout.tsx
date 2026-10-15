import { Link, Tabs } from "expo-router";
import { Text, View } from "react-native";
import { t, useLocale } from "@/i18n";
import { isBossRole, useSession } from "@/session";
import { colors, MIN_TOUCH, spacing } from "@/theme";

function HeaderLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as never} accessibilityRole="link" accessibilityLabel={label} style={{ minHeight: MIN_TOUCH, paddingHorizontal: spacing[3], paddingVertical: spacing[3] }}>
      <Text style={{ color: colors.tinta, fontWeight: "700", fontSize: 16 }}>{label}</Text>
    </Link>
  );
}

export default function TabsLayout() {
  useLocale();
  const { user, role, companyId } = useSession();
  const multipleCompanies = (user?.companies.length ?? 0) > 1;
  const canCreate = isBossRole(role);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tinta,
        tabBarInactiveTintColor: colors.graficaNeutra,
        tabBarStyle: { backgroundColor: colors.etiqueta, borderTopColor: colors.anaquelBorde },
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
        headerStyle: { backgroundColor: colors.etiqueta },
        headerTitleStyle: { fontWeight: "800" },
        headerRight: () => (
          <View style={{ flexDirection: "row" }}>
            {canCreate ? <HeaderLink href="/orden-form/nueva" label={t("orders.new")} /> : null}
            {multipleCompanies ? <HeaderLink href="/empresa" label={user?.companies.find((c) => c.id === companyId)?.name ?? "⇄"} /> : null}
          </View>
        ),
      }}
    >
      <Tabs.Screen name="ordenes/index" options={{ title: t("tabs.orders"), tabBarIcon: () => null }} />
      <Tabs.Screen name="ordenes/[id]" options={{ href: null, title: t("orders.title") }} />
      <Tabs.Screen name="tickets" options={{ title: t("tabs.tickets"), tabBarIcon: () => null }} />
      <Tabs.Screen name="perfil" options={{ title: t("tabs.profile"), tabBarIcon: () => null }} />
    </Tabs>
  );
}
