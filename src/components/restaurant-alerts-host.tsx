import { useRouter } from "expo-router";
import { useRestaurantAlerts, type RestaurantAlert } from "@/hooks/use-restaurant-alerts";
import { useSession } from "@/session";
import { RestaurantAlertBanner } from "./restaurant-alert-banner";

function Alerts() {
  const router = useRouter();
  const { alerts, dismiss } = useRestaurantAlerts();
  const open = (alert: RestaurantAlert) => {
    dismiss(alert.key);
    const checkId = alert.kind === "ready" ? alert.item.check_id : alert.checkId;
    router.push(`/pedido?cuenta=${checkId}&hoja=1` as never);
  };
  return <RestaurantAlertBanner alerts={alerts} onOpen={open} onDismiss={dismiss} />;
}

/** Monta los avisos del restaurante sobre toda la app mientras haya sesión; una empresa sin restaurante no tiene avisos. */
export function RestaurantAlertsHost() {
  const { user, companyId } = useSession();
  if (!user || companyId == null) return null;
  return <Alerts />;
}
