import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { SkeletonBlock } from "@/components/skeleton";
import { TakeOrderScreen } from "@/components/take-order/take-order-screen";
import { useScreenModeState } from "@/components/take-order/use-screen-mode";
import { t } from "@/i18n";
import { space } from "@/theme";

/**
 * Tomar pedido (spec 018): con mesas trabaja con cuentas y sin ellas, en modo pedido, con órdenes de trabajo.
 * Se abre desde el botón de Órdenes y acepta `?cuenta=<id>` para abrir una cuenta concreta (spec 023).
 */
export default function Pedido() {
  const { cuenta } = useLocalSearchParams<{ cuenta?: string }>();
  const { mode, ready } = useScreenModeState();
  const id = Number(cuenta);
  const initialCheckId = Number.isInteger(id) && id > 0 ? id : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t("takeOrder.title") }} />
      {ready && mode === "none" ? (
        // Sin mesas ni modo pedido no hay pantalla de tomar pedido: se vuelve a Órdenes.
        <Redirect href="/(tabs)/ordenes" />
      ) : !ready || mode === "none" ? (
        <View style={{ flex: 1, padding: space[4], gap: space[3] }}>
          <SkeletonBlock height={90} />
          <SkeletonBlock height={160} />
        </View>
      ) : (
        <TakeOrderScreen mode={mode} initialCheckId={mode === "restaurant" ? initialCheckId : undefined} />
      )}
    </>
  );
}
