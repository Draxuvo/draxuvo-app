import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { ApiError, NetworkError } from "@/api/client";
import { describeError, ErrorView } from "@/components/error-view";
import { AppText, Segmented } from "@/components/ui";
import { useRestaurantMenu } from "@/hooks/use-restaurant";
import { useOrderTransition } from "@/hooks/use-orders";
import { haptic } from "@/lib/haptics";
import { toast } from "@/toast/store";
import { t, useLocale } from "@/i18n";
import { isBossRole, useSession } from "@/session";
import { space, TAB_BAR_HEIGHT, useTheme } from "@/theme";
import type { Line, MenuCard, MenuSection } from "./lib";
import { MenuCards } from "./menu-cards";
import { OrderPanel } from "./order-panel";
import { PaySheet } from "./pay-sheet";
import { Plan } from "./plan";
import { useOrderSource, type Selection, type SourceTile } from "./use-order-source";

type Tab = "tables" | "order" | "menu";

/** Ancho desde el que el plano, la orden y el menú caben juntos (tableta). */
export const WIDE = 768;

/**
 * Pantalla de tomar pedido (spec 018): plano de mesas, orden y menú de tarjetas sin salir de ella. En el
 * teléfono se alternan en pestañas; en una tableta, la orden y el plano van a la izquierda y el menú a la derecha.
 */
export function TakeOrderScreen({ mode }: { mode: "restaurant" | "orders" }) {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const { role } = useSession();
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("tables");
  // Aviso de cuenta u orden cerrada afuera: se decide al renderizar y se muestra como toast en un efecto.
  const [closedNotice, setClosedNotice] = useState<{ text: string; id: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [sending, setSending] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const source = useOrderSource(mode, selection);
  const menuQuery = useRestaurantMenu();
  // Lo que se cobra o cancela en otro lado deja de verse aquí (spec 021): se cierra con un aviso y vuelve al plano.
  // No avisa mientras la propia persona cobra o libera: esas acciones limpian la selección solas.
  const { closedReason } = source;
  if (closedReason && selection && !paying && !releasing) {
    setSelection(null);
    setTab("tables");
    setClosedNotice((prev) => ({ text: t(`takeOrder.${closedReason}`), id: (prev?.id ?? 0) + 1 }));
  }
  useEffect(() => {
    if (closedNotice) toast.info(closedNotice.text);
  }, [closedNotice]);
  const finish = useOrderTransition(selection?.kind === "order" ? selection.id : 0);

  const menu: MenuSection[] = (menuQuery.data?.menu ?? []).map((group) => ({
    category: group.category,
    items: group.items.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), sold_out: p.sold_out, low: p.low, available_qty: p.available_qty })),
  }));

  // Ejecuta un cambio; si no se guarda, lo dice y la orden queda como estaba (FR-010).
  const run = async (work: () => Promise<unknown>) => {
    try {
      await work();
    } catch (failure) {
      haptic.warning();
      const occupied = failure instanceof ApiError && failure.code === "table_occupied";
      toast.error(occupied ? t("tables.occupied") : failure instanceof NetworkError ? t("check.notSaved") : describeError(failure));
      source.refetch();
    }
  };

  const pick = (tile: SourceTile) => {
    if (tile.selection) {
      setSelection(tile.selection);
      setTab("order");
      return;
    }
    if (tile.tableId == null) return;
    void run(async () => {
      setSelection(await source.create({ tableId: tile.tableId as number }));
      setTab("menu");
    });
  };

  const createNamed = (name: string) =>
    run(async () => {
      setSelection(await source.create({ name }));
      setTab("menu");
    });

  const send = async () => {
    setSending(true);
    try {
      const result = await source.send();
      haptic.success();
      if (result.sent.length) toast.success(t("takeOrder.sendDone", { number: result.kitchen_order.number }));
      // Un rechazo por existencias es lo importante: va después para quedarse en pantalla.
      if (result.rejected.length) toast.error(result.rejected.map((r) => t("check.rejectedItem", { name: r.name })).join(" · "));
    } catch (failure) {
      haptic.warning();
      toast.error(failure instanceof NetworkError ? t("check.notSent") : describeError(failure));
    } finally {
      setSending(false);
    }
  };

  // Liberar la mesa: sin productos se cancela de una vez; con productos sin mandar se pide confirmar.
  const doRelease = async () => {
    setReleasing(true);
    await run(async () => {
      await source.release();
      setSelection(null);
      setTab("tables");
      haptic.success();
      toast.success(t("takeOrder.released"));
    });
    setReleasing(false);
  };
  const release = () => {
    const current = source.current;
    if (!current?.canRelease) return;
    if (!current.lines.some((l) => !l.cancelled)) return void doRelease();
    Alert.alert(t("takeOrder.releaseTitle"), t("takeOrder.releaseBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("takeOrder.releaseConfirm"), style: "destructive", onPress: () => void doRelease() },
    ]);
  };

  // Una orden abierta se termina antes de cobrarla (R9).
  const charge = () => {
    const current = source.current;
    if (!current) return;
    if (current.order && current.order.status !== "done") {
      void run(async () => {
        await finish.mutateAsync("finish");
        setPaying(true);
      });
      return;
    }
    setPaying(true);
  };

  if (source.error) return <ErrorView error={undefined} onRetry={source.refetch} />;

  const current = source.current;
  const plan = (
    <Plan tiles={source.tiles} mode={mode} selection={selection} onPick={pick} onCreate={(name) => void createNamed(name)} creating={false} loading={source.loading} />
  );
  const orderPanel = (
    <OrderPanel
      current={current}
      loading={source.currentLoading}
      busy={false}
      sending={sending}
      onQuantity={(line: Line, quantity: number) => void run(() => source.setQuantity(line, quantity))}
      onRemove={(line: Line) => void run(() => source.remove(line))}
      onAddMore={wide ? undefined : () => setTab("menu")}
      onSend={() => void send()}
      onCharge={charge}
      onRelease={release}
      onOpenCheck={current?.check ? () => router.push(`/cuenta/${current.check?.id}` as never) : undefined}
    />
  );
  const menuCards = (
    <MenuCards menu={menu} loading={menuQuery.isLoading} disabled={!current?.canAdd} countOf={(card) => source.inOrder(card)} onTap={(card: MenuCard) => void run(() => source.tap(card))} />
  );

  const banner = (
    <>
      {isBossRole(role) && source.alerts > 0 ? (
        <AppText tone="stamp" variant="bodyStrong" accessibilityRole="alert" testID="stock-alerts">
          {t("takeOrder.stockAlerts", { count: source.alerts })}
        </AppText>
      ) : null}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {wide ? (
        <View style={{ flex: 1, flexDirection: "row", gap: space[4], padding: space[4] }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space[5], paddingBottom: TAB_BAR_HEIGHT + 80 }} keyboardShouldPersistTaps="handled">
            {banner}
            {plan}
            {orderPanel}
          </ScrollView>
          <ScrollView style={{ flex: 1.2 }} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 80 }} keyboardShouldPersistTaps="handled">
            {menuCards}
          </ScrollView>
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: space[4], paddingTop: space[3] }}>
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: "tables", label: t("takeOrder.tabTables") },
                { value: "order", label: t("takeOrder.tabOrder"), count: current?.lines.filter((l) => !l.cancelled).length },
                { value: "menu", label: t("takeOrder.tabMenu") },
              ]}
            />
          </View>
          <ScrollView
            contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: TAB_BAR_HEIGHT + 80 }}
            keyboardShouldPersistTaps="handled"
            refreshControl={tab === "tables" ? <RefreshControl refreshing={source.refreshing} onRefresh={source.refetch} tintColor={c.primary} colors={[c.primary]} /> : undefined}
          >
            {banner}
            {tab === "tables" ? plan : tab === "order" ? orderPanel : menuCards}
          </ScrollView>
        </>
      )}
      <PaySheet
        current={current}
        visible={paying}
        onClose={() => setPaying(false)}
        onPaid={(ticketId) => {
          setPaying(false);
          setSelection(null);
          router.push(`/ticket/${ticketId}` as never);
        }}
      />
    </View>
  );
}
