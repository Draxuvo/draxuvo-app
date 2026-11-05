import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { isEntryBlocking, subscribeEntryBlocking } from "@/attendance/prompted";
import { PermissionSheet } from "@/components/push/permission-sheet";
import { t } from "@/i18n";
import { useSession } from "@/session";
import { toast } from "@/toast/store";
import { ensureChannels } from "./channels";
import { parsePushData, planOpen } from "./open";
import { markAsked, permissionState, requestPermission, wasAsked } from "./permission";
import { ensureRegistered, flushPendingUnregister } from "./registration";

// Con la app a la vista no se dibuja la notificación del sistema (FR-019): «comanda lista» ya la avisa
// `RestaurantAlertsHost` con su sonido y los demás tipos salen como aviso dentro de la app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

// Avisos tocados que ya se abrieron. Expo recuerda el último aviso tocado aunque haya llegado por el listener; sin esto,
// al iniciar sesión otra vez (incluso con otra persona) `getLastNotificationResponseAsync` lo volvía a abrir.
const handledResponses = new Set<string>();

function PushRuntime({ userId }: { userId: number }) {
  const router = useRouter();
  const { user, companyId, setCompany } = useSession();
  const [asking, setAsking] = useState(false);
  const sessionRef = useRef({ user, companyId, setCompany });
  useEffect(() => {
    sessionRef.current = { user, companyId, setCompany };
  }, [user, companyId, setCompany]);

  const sync = useCallback(async () => {
    await flushPendingUnregister();
    await ensureRegistered(userId);
  }, [userId]);

  // Canales, registro y, la primera vez, la hoja de permiso; el registro se refresca al volver a primer plano.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureChannels().catch(() => {});
      await sync();
      if (!cancelled && (await permissionState()) === "askable" && !(await wasAsked(userId))) setAsking(true);
    })();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [sync, userId]);

  const open = useCallback(
    async (raw: unknown) => {
      const data = parsePushData(raw);
      const current = sessionRef.current;
      if (!data || !current.user) return;
      const plan = planOpen(data, current.user, current.companyId);
      if (plan.action === "noAccess") {
        toast.error(t("push.open.noAccess"));
        return;
      }
      if (plan.switchTo != null) await current.setCompany(plan.switchTo);
      router.push(plan.path as never);
    },
    [router],
  );

  // Tocar un aviso con la app abierta o en segundo plano, y el que abrió la app desde cerrada.
  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      const id = response.notification.request.identifier;
      if (handledResponses.has(id)) return;
      handledResponses.add(id);
      void open(response.notification.request.content.data);
    };
    const responses = Notifications.addNotificationResponseReceivedListener(handle);
    void Notifications.getLastNotificationResponseAsync().then(handle);
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      const parsed = parsePushData(data);
      if (!parsed || parsed.kind === "check_ready") return;
      toast.info([title, body].filter(Boolean).join(": "));
    });
    return () => {
      responses.remove();
      received.remove();
    };
  }, [open]);

  const finishAsking = async (enable: boolean) => {
    setAsking(false);
    await markAsked(userId);
    if (enable && (await requestPermission())) await ensureRegistered(userId);
  };

  // La hoja espera a que se cierre «Marcar entrada» para no salir encimada (spec 026 y 057).
  const entryBlocking = useSyncExternalStore(subscribeEntryBlocking, isEntryBlocking);

  return <PermissionSheet visible={asking && !entryBlocking} onEnable={() => void finishAsking(true)} onLater={() => void finishAsking(false)} />;
}

/** Avisos push de la app (spec 057): solo con sesión abierta. */
export function PushHost() {
  const { status, user } = useSession();
  if (status !== "signedIn" || !user) return null;
  return <PushRuntime userId={user.id} />;
}
