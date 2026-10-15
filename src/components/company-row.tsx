import { View } from "react-native";
import type { CompanyAccess } from "@/api/orders";
import type { UserCompany } from "@/api/types";
import { t } from "@/i18n";
import { space, useTheme } from "@/theme";
import { Monogram } from "./order-card";
import { AppText, Card, Icon } from "./ui";

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
  const { c } = useTheme();
  const role = t(`company.roles.${company.role}`);
  const notice = access === "expired" ? t("company.expired") : access === "noModule" ? t("company.noModule") : null;
  return (
    <Card
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: space[3], borderColor: active ? c.primary : c.line, borderWidth: active ? 2 : 1 }}
      accessibilityLabel={`${company.name}, ${role}${active ? `, ${t("company.current")}` : ""}${notice ? `. ${notice}` : ""}`}
    >
      <Monogram name={company.name} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="title" numberOfLines={1}>
          {company.name}
        </AppText>
        <AppText tone="muted">{role}</AppText>
        {notice ? (
          <AppText variant="label" tone="stamp" style={{ letterSpacing: 0.2 }}>
            {notice}
          </AppText>
        ) : null}
      </View>
      {active ? <Icon name="check-circle" tone="primary" /> : <Icon name="chevron-right" tone="muted" />}
    </Card>
  );
}
