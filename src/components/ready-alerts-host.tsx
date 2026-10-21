import { useRouter } from "expo-router";
import type { ReadyItem } from "@/api/types";
import { useReadyAlerts } from "@/hooks/use-ready-alerts";
import { useSession } from "@/session";
import { ReadyBanner } from "./ready-banner";

function Alerts() {
  const router = useRouter();
  const { alerts, dismiss } = useReadyAlerts();
  const open = (item: ReadyItem) => {
    dismiss(item.id);
    router.push(`/pedido?cuenta=${item.check_id}&hoja=1` as never);
  };
  return <ReadyBanner alerts={alerts} onOpen={open} onDismiss={dismiss} />;
}

/** Monta los avisos sobre toda la app mientras haya sesión; una empresa sin restaurante no tiene avisos. */
export function ReadyAlertsHost() {
  const { user, companyId } = useSession();
  if (!user || companyId == null) return null;
  return <Alerts />;
}
