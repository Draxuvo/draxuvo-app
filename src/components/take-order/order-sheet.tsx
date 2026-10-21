import { type ReactNode, useMemo } from "react";
import { KeyboardAvoidingView, Modal, PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "@/i18n";
import { ToastHost } from "@/toast/toast-host";
import { radius, space, useTheme } from "@/theme";
import { AppText, IconButton } from "../ui";

/**
 * La orden como hoja que sube desde abajo (spec 024). Se cierra con el botón, tocando fuera o arrastrando el asa hacia
 * abajo. Lleva su copia del aviso (toast) porque un `Modal` tapa al de la raíz. El fondo ocupa toda la pantalla y la
 * hoja va pegada abajo, con el margen de la barra del sistema, para que sus botones nunca queden tapados.
 */
export function OrderSheet({ visible, title, onClose, onBack, children }: { visible: boolean; title: string; onClose: () => void; /** En las vistas secundarias (motivo, meseros) regresa a la orden. */ onBack?: () => void; children: ReactNode }) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 6,
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 40 || g.vy > 0.8) onClose();
        },
      }),
    [onClose],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityLabel={t("takeOrder.closeOrder")} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} />
        <KeyboardAvoidingView behavior="padding">
          <View
            style={{
              maxHeight: height * 0.88,
              backgroundColor: c.background,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingBottom: insets.bottom + space[3],
            }}
          >
            <View {...drag.panHandlers} style={{ paddingTop: space[2] }}>
              <View accessible={false} style={{ alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: c.line }} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space[4], paddingTop: space[2] }}>
                {onBack ? <IconButton icon="arrow-left" label={t("takeOrder.back")} onPress={onBack} /> : null}
                <AppText variant="title" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
                  {title}
                </AppText>
                <IconButton icon="x" label={t("takeOrder.closeOrder")} onPress={onClose} />
              </View>
            </View>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: space[4], paddingTop: space[2], gap: space[3] }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
      <ToastHost announce={false} />
    </Modal>
  );
}
