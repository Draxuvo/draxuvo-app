import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { BrandMark } from "@/components/brand";
import { AppText, Button } from "@/components/ui";
import { t } from "@/i18n";
import { useSession } from "@/session";
import { fadeIn, space, useTheme } from "@/theme";

const PANEL_URL = (process.env.EXPO_PUBLIC_PANEL_URL ?? "https://app.draxuvo.com").replace(/\/$/, "");

/**
 * Empresa suspendida por falta de pago (spec 031): no se puede abrir nada hasta que se pague. Dueño y
 * administrador pagan desde aquí; los demás avisan al dueño. Se desbloquea sola al confirmarse el pago.
 */
export function SuspendedScreen() {
  const { c } = useTheme();
  const { suspension, role, clearSuspension, signOut } = useSession();
  const [checking, setChecking] = useState(false);
  const [stillSuspended, setStillSuspended] = useState(false);
  const canPay = role === "owner" || role === "admin";

  // La API deja de responder 403 al confirmarse el pago.
  const check = useCallback(async () => {
    setChecking(true);
    try {
      await api.get("/api/v1/company");
      clearSuspension();
    } catch {
      setStillSuspended(true);
    } finally {
      setChecking(false);
    }
  }, [clearSuspension]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  const cancelsOn = suspension?.cancels_at ? new Date(suspension.cancels_at).toLocaleDateString() : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <Animated.View entering={fadeIn} style={{ flex: 1, justifyContent: "center", padding: space[6], gap: space[4] }}>
        <BrandMark size={64} />
        <AppText variant="display" accessibilityRole="header">{t("suspended.title")}</AppText>
        <AppText>{canPay ? t("suspended.ownerBody") : t("suspended.memberBody")}</AppText>
        {suspension?.reason && (
          <AppText tone="muted">
            {suspension.reason === "plan_change" ? t("suspended.reasonPlanChange") : t("suspended.reasonOverdue")}
          </AppText>
        )}
        {canPay && suspension?.plan && <AppText tone="muted">{t("suspended.pending", { plan: suspension.plan })}</AppText>}
        {cancelsOn && <AppText tone="muted">{t("suspended.cancelsOn", { date: cancelsOn })}</AppText>}
        {stillSuspended && <AppText tone="primary">{t("suspended.stillSuspended")}</AppText>}
        <View style={{ gap: space[3] }}>
          {canPay && (
            <Button
              label={t("suspended.payNow")}
              icon="credit-card"
              onPress={() => void Linking.openURL(suspension?.pay_url || `${PANEL_URL}/es/suscripcion`)}
            />
          )}
          <Button label={t("suspended.paid")} variant="outline" loading={checking} onPress={() => void check()} />
          <Button label={t("suspended.signOut")} variant="outline" onPress={() => void signOut()} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
