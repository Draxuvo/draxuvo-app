import { Stack } from "expo-router";
import { TakeOrderScreen } from "@/components/take-order/take-order-screen";
import { t } from "@/i18n";

/** Tomar pedido con el plano y el menú de tarjetas para empresas sin restaurante en modo pedido (spec 018). */
export default function Pedido() {
  return (
    <>
      <Stack.Screen options={{ title: t("takeOrder.title") }} />
      <TakeOrderScreen mode="orders" />
    </>
  );
}
