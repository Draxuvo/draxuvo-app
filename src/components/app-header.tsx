import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOutbox } from "@/hooks/use-outbox";
import { t } from "@/i18n";
import { space, useTheme } from "@/theme";
import { AppText, IconButton } from "./ui";

/** Cabecera de las pestañas: dice dónde estás y avisa de lo que espera red. */
export function AppHeader({ title }: { title: string }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const pending = useOutbox().filter((item) => item.state !== "discardable").length;
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
      {pending > 0 ? <IconButton icon="upload-cloud" label={t("orders.outbox.count", { count: pending })} badge={pending} onPress={() => {}} tone="muted" /> : null}
    </View>
  );
}
