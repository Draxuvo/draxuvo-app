import { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import type { UserCompany } from "@/api/types";
import { useSession } from "@/session";
import { t } from "@/i18n";
import { space } from "@/theme";
import { Monogram } from "./order-card";
import { AppText } from "./ui";

/**
 * Marca de una empresa (spec 063): su logo o, sin logo (o si no carga), el monograma con su inicial. Sustituye a la marca
 * Draxuvo en las pantallas con empresa activa; el logo se ajusta sin recortarse ni deformarse.
 */
export function CompanyLogo({
  company,
  size = 44,
  wide = false,
}: {
  company: Pick<UserCompany, "name" | "logo_url">;
  size?: number;
  /** En pantallas grandes un logo ancho puede ocupar más que su alto; en filas se queda en un cuadro. */
  wide?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = company.logo_url ?? null;
  if (!url || failedUrl === url) return <Monogram name={company.name} size={size} />;

  return (
    <Image
      source={{ uri: url }}
      contentFit="contain"
      accessibilityLabel={t("company.logoAlt", { name: company.name })}
      onError={() => setFailedUrl(url)}
      style={{ height: size, width: wide ? size * 2.5 : size }}
    />
  );
}

/** Logo y nombre de la empresa activa, para las pantallas grandes (desbloqueo, suscripción suspendida). */
export function ActiveCompanyMark({ size = 64 }: { size?: number }) {
  const { user, companyId } = useSession();
  const company = user?.companies.find((item) => item.id === companyId) ?? user?.companies[0];
  if (!company) return null;
  return (
    <View style={{ gap: space[3], alignItems: "flex-start" }}>
      <CompanyLogo company={company} size={size} wide />
      <AppText variant="display" numberOfLines={2}>
        {company.name}
      </AppText>
    </View>
  );
}
