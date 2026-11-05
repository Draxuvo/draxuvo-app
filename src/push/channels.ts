import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { t } from "@/i18n";

/** Canales de Android (spec 057, FR-020): «Comandas y órdenes» con prioridad alta y «Alertas del negocio». */
export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("orders", {
    name: t("push.channels.orders"),
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync("business", {
    name: t("push.channels.business"),
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}
