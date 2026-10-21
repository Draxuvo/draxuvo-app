import { View } from "react-native";
import { t } from "@/i18n";
import { space } from "@/theme";
import { AppText, Button } from "../ui";

/** Encabezado del menú (spec 024): la mesa o cuenta que se atiende y el botón para cambiar de mesa. */
export function MenuHeader({ title, onChangeTable }: { title: string; onChangeTable: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2], paddingHorizontal: space[4], paddingTop: space[2] }}>
      <AppText variant="headline" numberOfLines={1} accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </AppText>
      <Button label={t("takeOrder.changeTable")} icon="grid" variant="text" onPress={onChangeTable} />
    </View>
  );
}
