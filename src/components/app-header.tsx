import { useRouter } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlerts, useCanSeeAlerts } from "@/hooks/use-alerts";
import { useOutbox } from "@/hooks/use-outbox";
import { t } from "@/i18n";
import { space, useTheme } from "@/theme";
import { AppText, IconButton } from "./ui";

/** Cabecera de las pestañas: dice dónde estás y avisa de lo que espera red. */
export function AppHeader({ title }: { title: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pending = useOutbox().filter((item) => item.state !== "discardable").length;
  const router = useRouter();
  // Alertas operativas (spec 045): solo dueño y administrador; para el resto la consulta ni se hace.
  const canSeeAlerts = useCanSeeAlerts();
  const alerts = useAlerts().data?.count ?? 0;
  return (
    <View
      style={{
        paddingTop: insets.top + space[1],
        paddingHorizontal: space[2],
        paddingBottom: space[2],
        backgroundColor: c.background,
        flexDirection: "row",
        alignItems: "center",
        gap: space[1],
      }}
    >
      <AppText variant="headline" style={{ flex: 1, paddingLeft: space[2] }} accessibilityRole="header" numberOfLines={1}>
        {title}
      </AppText>
      {canSeeAlerts ? (
        <IconButton
          icon="bell"
          label={alerts > 0 ? t("alerts.bellCount", { count: alerts }) : t("alerts.bell")}
          badge={alerts > 0 ? alerts : undefined}
          onPress={() => router.push("/alertas" as never)}
          tone={alerts > 0 ? "primary" : "muted"}
        />
      ) : null}
      {pending > 0 ? <IconButton icon="upload-cloud" label={t("orders.outbox.count", { count: pending })} badge={pending} onPress={() => {}} tone="muted" /> : null}
    </View>
  );
}
