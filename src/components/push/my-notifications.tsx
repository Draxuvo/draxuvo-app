import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Switch, View } from "react-native";
import { getPushPreference, updatePushPreference } from "@/api/push";
import type { PushKind, PushPreference } from "@/api/types";
import { describeError } from "@/components/error-view";
import { haptic } from "@/lib/haptics";
import { t, useLocale } from "@/i18n";
import { pushAvailable } from "@/push/config";
import { permissionState, requestPermission, type PushPermission } from "@/push/permission";
import { ensureRegistered } from "@/push/registration";
import { useSession } from "@/session";
import { space, useTheme } from "@/theme";
import { toast } from "@/toast/store";
import { AppText, Button, Card, Icon } from "../ui";

/**
 * «Mis avisos» (spec 057, US2): un interruptor por tipo de aviso push que le toca a la persona en la empresa activa, y el
 * estado del permiso del teléfono (FR-006 a FR-008). Los interruptores se pueden cambiar aunque el permiso falte. En una
 * compilación sin avisos (sin proyecto de EAS) solo dice que no están disponibles y no consulta nada.
 */
export function MyNotifications() {
  useLocale();
  const { c } = useTheme();
  const { user, companyId } = useSession();
  const queryClient = useQueryClient();
  const key = ["push-preference", companyId];
  const available = pushAvailable();
  const preference = useQuery({ queryKey: key, queryFn: getPushPreference, enabled: available });
  const [permission, setPermission] = useState<PushPermission | null>(null);

  const refreshPermission = useCallback(() => void permissionState().then(setPermission), []);
  useEffect(() => {
    refreshPermission();
    // Al volver a la app se vuelve a pedir: pudo cambiarse desde otro teléfono.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      refreshPermission();
      if (available) void queryClient.invalidateQueries({ queryKey: ["push-preference", companyId] });
    });
    return () => subscription.remove();
  }, [refreshPermission, available, queryClient, companyId]);

  const update = useMutation({
    mutationFn: updatePushPreference,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PushPreference>(key);
      if (previous) queryClient.setQueryData<PushPreference>(key, { ...previous, ...patch });
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      haptic.warning();
      toast.error(describeError(error));
    },
    onSuccess: (data) => queryClient.setQueryData(key, data),
  });

  const enable = async () => {
    if ((await requestPermission()) && user) await ensureRegistered(user.id);
    refreshPermission();
  };

  const kinds: PushKind[] = available ? (preference.data?.available ?? []) : [];

  return (
    <Card style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Icon name="bell" />
        <AppText variant="bodyStrong" accessibilityRole="header" style={{ flex: 1 }}>
          {t("push.prefs.title")}
        </AppText>
      </View>

      {permission === "unavailable" ? <AppText tone="muted">{t("push.prefs.unavailable")}</AppText> : null}
      {permission === "blocked" ? (
        <View style={{ gap: space[2] }} testID="push-blocked">
          <AppText tone="stamp">{t("push.prefs.blocked")}</AppText>
          <Button label={t("push.prefs.openSettings")} variant="tonal" icon="settings" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
      {permission === "askable" ? (
        <View style={{ gap: space[2] }}>
          <AppText tone="muted">{t("push.prefs.askable")}</AppText>
          <Button label={t("push.prefs.enable")} variant="tonal" icon="bell" onPress={() => void enable()} />
        </View>
      ) : null}

      {preference.isError ? <AppText tone="muted">{t("push.prefs.loadError")}</AppText> : null}
      {preference.data && kinds.length === 0 ? <AppText tone="muted">{t("push.prefs.none")}</AppText> : null}
      {kinds.map((kind) => (
        <View key={kind} style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 }}>
          <View style={{ flex: 1 }}>
            <AppText>{t(`push.kinds.${kind}`)}</AppText>
            <AppText tone="muted">{t(`push.hints.${kind}`)}</AppText>
          </View>
          <Switch
            accessibilityLabel={t(`push.kinds.${kind}`)}
            value={preference.data?.[kind] ?? true}
            onValueChange={(value) => {
              haptic.select();
              update.mutate({ [kind]: value });
            }}
            trackColor={{ true: c.primary, false: c.line }}
            thumbColor={c.surface}
          />
        </View>
      ))}
    </Card>
  );
}
