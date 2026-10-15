import { Linking, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, AppText } from "@/components/ui";
import { t } from "@/i18n";
import { colors, spacing } from "@/theme";

// Enlaces genéricos: se reemplazan por los de la ficha cuando existan las cuentas de tienda (STORE.md).
const STORE_URL = Platform.select({
  ios: "https://apps.apple.com/app/draxuvo",
  default: "https://play.google.com/store/apps/details?id=com.draxuvo.app",
});

export default function Actualizar() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.anaquel, justifyContent: "center", padding: spacing[6], gap: spacing[4] }}>
      <AppText variant="headline">{t("update.title")}</AppText>
      <AppText>{t("update.body")}</AppText>
      <Button label={t("update.action")} onPress={() => void Linking.openURL(STORE_URL)} />
    </SafeAreaView>
  );
}
