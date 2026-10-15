import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { FlatList } from "react-native";
import { probeCompanyAccess } from "@/api/orders";
import { CompanyRow } from "@/components/company-row";
import { t, useLocale } from "@/i18n";
import { useSession } from "@/session";
import { colors, spacing } from "@/theme";

export default function Empresa() {
  useLocale();
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
      <FlatList
        style={{ backgroundColor: colors.anaquel }}
        contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }}
        data={companies}
        keyExtractor={(company) => String(company.id)}
        renderItem={({ item, index }) => (
          <CompanyRow
            company={item}
            active={item.id === companyId}
            access={probes[index]?.data ?? "checking"}
            onPress={() => void choose(item.id)}
          />
        )}
      />
    </>
  );
}
