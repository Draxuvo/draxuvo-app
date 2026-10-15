import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import Animated from "react-native-reanimated";
import { probeCompanyAccess } from "@/api/orders";
import { CompanyRow } from "@/components/company-row";
import { t, useLocale } from "@/i18n";
import { useSession } from "@/session";
import { rowEnter, space, useTheme } from "@/theme";

export default function Empresa() {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const client = useQueryClient();
  const { user, companyId, setCompany } = useSession();
  const companies = user?.companies ?? [];

  const probes = useQueries({
    queries: companies.map((company) => ({
      queryKey: ["probe", user?.id, company.id],
      queryFn: () => probeCompanyAccess(company.id),
      staleTime: 60_000,
    })),
  });

  const choose = async (id: number) => {
    if (id !== companyId) {
      await setCompany(id);
      // Nada de la empresa anterior debe verse en la nueva: se limpia toda la caché (FR-004).
      client.clear();
    }
    router.replace("/(tabs)/ordenes");
  };

  return (
    <>
      <Stack.Screen options={{ title: t("company.title") }} />
      <Animated.FlatList
        style={{ backgroundColor: c.background }}
        contentContainerStyle={{ padding: space[4], gap: space[3] }}
        data={companies}
        keyExtractor={(company) => String(company.id)}
        renderItem={({ item, index }) => (
          <Animated.View entering={rowEnter(index)}>
            <CompanyRow company={item} active={item.id === companyId} access={probes[index]?.data ?? "checking"} onPress={() => void choose(item.id)} />
          </Animated.View>
        )}
      />
    </>
  );
}
