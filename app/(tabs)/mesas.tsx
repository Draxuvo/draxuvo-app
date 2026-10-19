import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { ApiError } from "@/api/client";
import { describeError, ErrorView } from "@/components/error-view";
import { EmptyState } from "@/components/empty-state";
import { EmptyOrdersArt } from "@/components/illustrations";
import { TableTile } from "@/components/table-tile";
import { AppText, Button, Field } from "@/components/ui";
import { useOpenCheck, useTables } from "@/hooks/use-restaurant";
import { haptic } from "@/lib/haptics";
import { t, useLocale } from "@/i18n";
import { isBossRole, useSession } from "@/session";
import { rowEnter, space, TAB_BAR_HEIGHT, useTheme } from "@/theme";

export default function Mesas() {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const { role } = useSession();
  const tables = useTables();
  const open = useOpenCheck();
  const [takeoutName, setTakeoutName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const go = (id: number) => router.push(`/cuenta/${id}` as never);

  const openTable = async (id: number) => {
    setMessage(null);
    try {
      const check = await open.mutateAsync({ dining_table_id: id });
      go(check.id);
    } catch (failure) {
      haptic.warning();
      const occupied = failure instanceof ApiError && failure.code === "table_occupied";
      setMessage(occupied ? t("tables.occupied") : describeError(failure));
      void tables.refetch();
    }
  };

  const openTakeout = async () => {
    if (!takeoutName.trim()) return;
    setMessage(null);
    try {
      const check = await open.mutateAsync({ takeout_name: takeoutName.trim() });
      setTakeoutName("");
      go(check.id);
    } catch (failure) {
      haptic.warning();
      setMessage(describeError(failure));
    }
  };

  if (tables.isError && !tables.data) return <ErrorView error={tables.error} onRetry={() => void tables.refetch()} />;

  const rows = tables.data?.results ?? [];
  const takeouts = tables.data?.takeouts ?? [];
  const alerts = tables.data?.stock_alerts ?? 0;

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: TAB_BAR_HEIGHT + 80 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={tables.isRefetching} onRefresh={() => void tables.refetch()} tintColor={c.primary} colors={[c.primary]} />}
    >
      {isBossRole(role) && alerts > 0 ? (
        <AppText tone="stamp" variant="bodyStrong" accessibilityRole="alert" testID="stock-alerts">
          {t("tables.stockAlerts", { count: alerts })}
        </AppText>
      ) : null}
      {message ? (
        <AppText tone="stamp" accessibilityRole="alert" testID="tables-error">
          {message}
        </AppText>
      ) : null}

      {tables.data && rows.length === 0 && takeouts.length === 0 ? (
        <EmptyState art={<EmptyOrdersArt />} title={t("tables.empty")} body={t("tables.emptyHint")} testID="tables-empty" />
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[3] }}>
        {rows.map((table, index) => (
          <Animated.View key={table.id} entering={rowEnter(index)} style={{ width: "47.5%", flexGrow: 1 }}>
            <TableTile name={table.name} check={table.check} onPress={() => (table.check ? go(table.check.id) : void openTable(table.id))} />
          </Animated.View>
        ))}
      </View>

      <View style={{ gap: space[3] }}>
        <AppText variant="title" accessibilityRole="header">
          {t("tables.takeouts")}
        </AppText>
        {takeouts.map((check) => (
          <TableTile key={check.id} name={check.takeout_name} check={check} onPress={() => go(check.id)} />
        ))}
        <Field label={t("tables.takeoutName")} value={takeoutName} onChangeText={setTakeoutName} placeholder={t("tables.takeoutNamePlaceholder")} returnKeyType="done" onSubmitEditing={() => void openTakeout()} />
        <Button label={t("tables.newTakeout")} icon="shopping-bag" variant="tonal" disabled={!takeoutName.trim()} loading={open.isPending} onPress={() => void openTakeout()} />
      </View>
    </ScrollView>
  );
}
