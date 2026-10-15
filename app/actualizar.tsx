import { Linking, Platform, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "@/components/brand";
import { AppText, Button } from "@/components/ui";
import { t } from "@/i18n";
import { riseIn, space, useTheme } from "@/theme";

// Enlaces genéricos: se reemplazan por los de la ficha cuando existan las cuentas de tienda (STORE.md).
const STORE_URL = Platform.select({
  ios: "https://apps.apple.com/app/draxuvo",
  default: "https://play.google.com/store/apps/details?id=com.draxuvo.app",
});

export default function Actualizar() {
  const { c } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <Animated.View entering={riseIn} style={{ flex: 1, justifyContent: "center", padding: space[6], gap: space[4] }}>
        <BrandMark size={64} />
        <View style={{ gap: space[2] }}>
          <AppText variant="display" accessibilityRole="header">
            {t("update.title")}
          </AppText>
          <AppText variant="bodyLarge" tone="muted">
            {t("update.body")}
          </AppText>
        </View>
        <Button label={t("update.action")} icon="download" onPress={() => void Linking.openURL(STORE_URL)} />
      </Animated.View>
    </SafeAreaView>
  );
}
