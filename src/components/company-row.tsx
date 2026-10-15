import { Pressable, View } from "react-native";
import type { CompanyAccess } from "@/api/orders";
import type { UserCompany } from "@/api/types";
import { t } from "@/i18n";
import { colors, MIN_TOUCH, radii, spacing } from "@/theme";
import { AppText } from "./ui";

/** Una empresa de la persona con su rol y, si aplica, por qué no podrá usar órdenes. */
export function CompanyRow({
  company,
  active,
  access,
  onPress,
}: {
  company: UserCompany;
  active: boolean;
  access: CompanyAccess | "checking";
  onPress: () => void;
}) {
  const role = t(`company.roles.${company.role}`);
  const notice = access === "expired" ? t("company.expired") : access === "noModule" ? t("company.noModule") : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${company.name}, ${role}${active ? `, ${t("company.current")}` : ""}${notice ? `. ${notice}` : ""}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: MIN_TOUCH,
        padding: spacing[4],
        gap: spacing[1],
        borderRadius: radii.etiqueta,
        borderWidth: 1.5,
        borderColor: active ? colors.tinta : colors.anaquelBorde,
        backgroundColor: colors.etiqueta,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[2] }}>
        <AppText variant="title" style={{ flexShrink: 1 }}>
          {company.name}
        </AppText>
        {active ? (
          <AppText variant="label" style={{ color: colors.sello }}>
            {t("company.current").toUpperCase()}
          </AppText>
        ) : null}
      </View>
      <AppText muted>{role}</AppText>
      {notice ? (
        <AppText variant="label" style={{ color: colors.alerta }}>
          {notice}
        </AppText>
      ) : null}
    </Pressable>
  );
}
