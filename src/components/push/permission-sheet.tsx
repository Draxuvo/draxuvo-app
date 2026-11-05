import { Modal, Pressable, StyleSheet, View } from "react-native";
import { t, useLocale } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText, Button, Icon } from "../ui";

/**
 * Explicación previa al permiso del sistema (spec 057, FR-001): solo «Activar» abre el diálogo de Android o iOS; «Ahora
 * no» lo deja para «Mis avisos» y la hoja no vuelve a salir.
 */
export function PermissionSheet({ visible, onEnable, onLater }: { visible: boolean; onEnable: () => void; onLater: () => void }) {
  useLocale();
  const { c } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, justifyContent: "center", padding: space[5] }]}>
        <Pressable accessibilityElementsHidden importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={onLater} />
        <View
          accessibilityViewIsModal
          testID="push-permission-sheet"
          style={{ backgroundColor: c.surface, borderRadius: radius.sheet, padding: space[5], gap: space[4], width: "100%", maxWidth: 420, alignSelf: "center" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
            <Icon name="bell" />
            <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
              {t("push.sheet.title")}
            </AppText>
          </View>
          <AppText tone="muted">{t("push.sheet.body")}</AppText>
          <View style={{ gap: space[2] }}>
            <Button label={t("push.sheet.enable")} icon="bell" onPress={onEnable} />
            <Button label={t("push.sheet.later")} variant="text" onPress={onLater} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
