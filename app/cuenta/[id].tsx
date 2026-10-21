import * as Crypto from "expo-crypto";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { ApiError, NetworkError } from "@/api/client";
import { sendRound } from "@/api/restaurant";
import type { Check, CheckItem, MenuProduct } from "@/api/types";
import { CancelReasonSheet } from "@/components/cancel-reason-sheet";
import { CheckLine } from "@/components/check-line";
import { describeError, ErrorView } from "@/components/error-view";
import { MenuPicker } from "@/components/menu-picker";
import { SkeletonBlock } from "@/components/skeleton";
import { AppText, Button, Divider } from "@/components/ui";
import { useApplyCheck, useCheck, useCheckActions, useRestaurantMenu, useWaiters } from "@/hooks/use-restaurant";
import { haptic } from "@/lib/haptics";
import { toast } from "@/toast/store";
import { t, useLocale } from "@/i18n";
import { radius, rowEnter, space, useTheme } from "@/theme";

const money = (value: string | number) => `$${Number(value).toFixed(2)}`;

function groupByRound(items: CheckItem[]): { number: number; items: CheckItem[] }[] {
  const rounds = new Map<number, CheckItem[]>();
  for (const item of items) {
    if (item.kitchen_order_number == null) continue;
    rounds.set(item.kitchen_order_number, [...(rounds.get(item.kitchen_order_number) ?? []), item]);
  }
  return [...rounds.entries()].sort(([a], [b]) => a - b).map(([number, list]) => ({ number, items: list }));
}

function WaiterPicker({ visible, current, onPick, onClose }: { visible: boolean; current?: number; onPick: (id: number) => void; onClose: () => void }) {
  const { c } = useTheme();
  const waiters = useWaiters(visible);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel={t("common.close")} onPress={onClose} style={{ flex: 1, backgroundColor: c.scrim }} />
      <View style={{ backgroundColor: c.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space[5], gap: space[2], maxHeight: "70%" }}>
        <AppText variant="title" accessibilityRole="header">
          {t("check.reassign")}
        </AppText>
        <ScrollView>
          {(waiters.data?.results ?? []).map((person) => (
            <Button key={person.id} label={person.name} variant={person.id === current ? "tonal" : "text"} onPress={() => onPick(person.id)} />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function Cuenta() {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const checkId = Number(id);
  const query = useCheck(checkId);
  const actions = useCheckActions(checkId);
  const apply = useApplyCheck();
  const menu = useRestaurantMenu();
  const [picker, setPicker] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CheckItem | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [sending, setSending] = useState(false);
  // La llave de un envío se conserva hasta el 2xx: reintentar por mala red nunca duplica la comanda.
  const sendKey = useRef<string | null>(null);

  const fail = (failure: unknown, fallback: "check.notSaved" | "check.notSent") => {
    haptic.warning();
    toast.error(failure instanceof NetworkError ? t(fallback) : describeError(failure));
    if (failure instanceof ApiError) void query.refetch();
  };

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, padding: space[4], gap: space[3] }}>
        <Stack.Screen options={{ title: t("check.title") }} />
        <SkeletonBlock height={90} />
        <SkeletonBlock height={160} />
      </View>
    );
  }
  if (query.isError || !query.data) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;

  const check: Check = query.data;
  const title = check.table ? t("check.table", { name: check.table.name }) : t("check.takeout", { name: check.takeout_name ?? "" });
  const drafts = check.items.filter((item) => item.status === "draft");
  const rounds = groupByRound(check.items);
  // El total que ve el mesero incluye lo que aún no manda; la API solo cobra lo ya mandado.
  const runningTotal = Number(check.total) + drafts.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
  const can = (action: Check["allowed_actions"][number]) => check.allowed_actions.includes(action);
  const open = check.status === "open";

  const run = async (work: () => Promise<unknown>, fallback: "check.notSaved" | "check.notSent" = "check.notSaved") => {
    try {
      await work();
    } catch (failure) {
      fail(failure, fallback);
    }
  };

  const send = async () => {
    setSending(true);
    sendKey.current ??= Crypto.randomUUID();
    try {
      const result = await sendRound(checkId, sendKey.current);
      sendKey.current = null;
      apply(result.check);
      if (result.rejected.length) toast.error(`${t("check.rejectedTitle")}: ${result.rejected.map((item) => t("check.rejectedItem", { name: item.name })).join(" · ")}`);
      haptic.success();
    } catch (failure) {
      if (!(failure instanceof NetworkError)) sendKey.current = null;
      fail(failure, "check.notSent");
    } finally {
      setSending(false);
    }
  };

  const addProduct = (product: MenuProduct, quantity: number, note?: string) =>
    run(() => actions.add.mutateAsync({ product_id: product.id, quantity, note }));

  const cancelCheck = () =>
    run(async () => {
      await actions.cancelCheck.mutateAsync(undefined);
      router.back();
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: 160 }}>
        <Animated.View entering={rowEnter(0)} style={{ gap: space[1] }}>
          <AppText tone="muted">{check.waiter ? t("tables.waiter", { name: check.waiter.name }) : ""}</AppText>
          {!open ? (
            <AppText variant="bodyStrong" tone="ok">
              {t("check.closed")}
            </AppText>
          ) : null}
        </Animated.View>

        {check.items.length === 0 ? (
          <View style={{ alignItems: "center", gap: space[2], paddingVertical: space[6] }}>
            <AppText variant="title">{t("check.empty")}</AppText>
            <AppText tone="muted">{t("check.emptyHint")}</AppText>
          </View>
        ) : null}

        {drafts.length > 0 ? (
          <View>
            <AppText variant="label" tone="muted" accessibilityRole="header">
              {t("check.draftSection").toUpperCase()}
            </AppText>
            {drafts.map((item) => (
              <CheckLine
                key={item.id}
                item={item}
                busy={actions.remove.isPending || actions.update.isPending}
                onDeliver={() => undefined}
                onCancel={() => undefined}
                onRemove={(line) => void run(() => actions.remove.mutateAsync(line.id))}
                onQuantity={(line, quantity) => void run(() => actions.update.mutateAsync({ itemId: line.id, quantity }))}
              />
            ))}
          </View>
        ) : null}

        {rounds.map((round) => (
          <View key={round.number} testID={`round-${round.number}`}>
            <Divider />
            <AppText variant="label" tone="muted" accessibilityRole="header" style={{ marginTop: space[3] }}>
              {t("check.round", { number: round.number }).toUpperCase()}
            </AppText>
            {round.items.map((item) => (
              <CheckLine
                key={item.id}
                item={item}
                busy={actions.deliver.isPending}
                onDeliver={(line) => void run(() => actions.deliver.mutateAsync(line.id))}
                onCancel={setCancelTarget}
                onRemove={() => undefined}
                onQuantity={() => undefined}
              />
            ))}
          </View>
        ))}

        {open ? (
          <View style={{ gap: space[2] }}>
            {can("reassign") ? <Button label={t("check.reassign")} variant="text" icon="users" onPress={() => setReassigning(true)} /> : null}
            {can("cancel") ? <Button label={t("check.cancelCheck")} variant="text" icon="x-circle" onPress={() => void cancelCheck()} /> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: space[4], gap: space[3], backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <AppText variant="title">{t("check.total")}</AppText>
          <AppText variant="figure" accessibilityLabel={`${t("check.total")} ${money(runningTotal)}`}>
            {money(runningTotal)}
          </AppText>
        </View>
        {open ? (
          <View style={{ flexDirection: "row", gap: space[3] }}>
            {can("add_item") ? <Button label={t("check.add")} icon="plus" variant="outline" onPress={() => setPicker(true)} style={{ flex: 1 }} /> : null}
            {can("send") ? <Button label={sending ? t("check.sending") : t("check.send")} icon="send" loading={sending} onPress={() => void send()} style={{ flex: 1 }} /> : null}
            {can("pay") && !can("send") && check.items.length > 0 ? <Button label={t("check.pay")} icon="credit-card" onPress={() => router.push(`/cuenta-cobro/${checkId}` as never)} style={{ flex: 1 }} /> : null}
          </View>
        ) : check.ticket_id ? (
          <Button label={t("check.viewTicket")} icon="file-text" onPress={() => router.replace(`/ticket/${check.ticket_id}` as never)} />
        ) : null}
      </View>

      <MenuPicker visible={picker} menu={menu.data?.menu ?? []} loading={menu.isLoading} busy={actions.add.isPending} onAdd={addProduct} onClose={() => setPicker(false)} />
      <CancelReasonSheet
        visible={!!cancelTarget}
        busy={actions.cancelItem.isPending}
        onClose={() => setCancelTarget(null)}
        onConfirm={(reason) => {
          const target = cancelTarget;
          setCancelTarget(null);
          if (target) void run(() => actions.cancelItem.mutateAsync({ itemId: target.id, reason }));
        }}
      />
      <WaiterPicker
        visible={reassigning}
        current={check.waiter?.id}
        onClose={() => setReassigning(false)}
        onPick={(waiterId) => {
          setReassigning(false);
          void run(() => actions.reassign.mutateAsync(waiterId));
        }}
      />
    </View>
  );
}
