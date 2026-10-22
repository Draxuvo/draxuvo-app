import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { ApiError, NetworkError } from "@/api/client";
import { describeError, ErrorView } from "@/components/error-view";
import { AppText } from "@/components/ui";
import { useRestaurantMenu } from "@/hooks/use-restaurant";
import { useOrderTransition } from "@/hooks/use-orders";
import { haptic } from "@/lib/haptics";
import { toast } from "@/toast/store";
import { t, useLocale } from "@/i18n";
import { isBossRole, useSession } from "@/session";
import { space, TAB_BAR_HEIGHT, useTheme } from "@/theme";
import { orderSummary, type Line, type MenuCard, type MenuSection } from "./lib";
import type { CheckItem } from "@/api/types";
import { CancelReasonForm } from "./cancel-reason-form";
import { MenuCards } from "./menu-cards";
import { MenuHeader } from "./menu-header";
import { OrderBar } from "./order-bar";
import { OrderSheet } from "./order-sheet";
import { OrderPanel } from "./order-panel";
import { PaySheet } from "./pay-sheet";
import { Plan } from "./plan";
import { WaiterList } from "./waiter-list";
import { useOrderSource, type Selection, type SourceTile } from "./use-order-source";

/** Ancho desde el que el plano, la orden y el menú caben juntos (tableta). */
export const WIDE = 768;

/**
 * Pantalla de tomar pedido (spec 018): plano de mesas, orden y menú de tarjetas sin salir de ella. En el
 * teléfono es un flujo de dos pasos (plano y menú con barra y hoja de la orden, spec 024); en una tableta, la orden y el plano van a la izquierda y el menú a la derecha.
 */
export function TakeOrderScreen({ mode, initialCheckId, initialSheet }: { mode: "restaurant" | "orders"; initialCheckId?: number; initialSheet?: boolean }) {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const { role } = useSession();
  const [selection, setSelection] = useState<Selection>(initialCheckId ? { kind: "check", id: initialCheckId } : null);
  // La hoja de la orden (teléfono): se abre desde la barra y se cierra sola si la selección se limpia.
  const [sheetOpen, setSheetOpen] = useState(!!initialCheckId && !!initialSheet);
  // Vista de la hoja: la orden, el motivo para cancelar un producto o la lista de meseros (spec 025).
  const [view, setView] = useState<{ kind: "order" } | { kind: "cancel"; item: CheckItem } | { kind: "waiters" }>({ kind: "order" });
  // Cuenta que ya se vio abierta en esta pantalla: solo esa se cierra sola si cambia afuera (spec 021).
  const [seenOpen, setSeenOpen] = useState<number | null>(null);
  // Aviso de cuenta u orden cerrada afuera: se decide al renderizar y se muestra como toast en un efecto.
  const [closedNotice, setClosedNotice] = useState<{ text: string; id: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [sending, setSending] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const source = useOrderSource(mode, selection, { waiters: view.kind === "waiters" });
  const menuQuery = useRestaurantMenu();
  // Lo que se cobra o cancela en otro lado deja de verse aquí (spec 021): se cierra con un aviso y vuelve al plano.
  // No avisa mientras la propia persona cobra o libera: esas acciones limpian la selección solas.
  const { closedReason } = source;
  if (selection && source.current && !source.current.readOnly && seenOpen !== selection.id) setSeenOpen(selection.id);
  // Una cuenta que llega ya cerrada (por un enlace o un aviso) se ve en solo lectura, sin cerrarse.
  if (closedReason && selection && seenOpen === selection.id && !paying && !releasing) {
    setSelection(null);
    setView({ kind: "order" });
    setClosedNotice((prev) => ({ text: t(`takeOrder.${closedReason}`), id: (prev?.id ?? 0) + 1 }));
  }
  useEffect(() => {
    if (closedNotice) toast.info(closedNotice.text);
  }, [closedNotice]);
  const finish = useOrderTransition(selection?.kind === "order" ? selection.id : 0);

  const menu: MenuSection[] = (menuQuery.data?.menu ?? []).map((group) => ({
    category: group.category,
    items: group.items.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), icon: p.icon, product_type: p.product_type, sold_out: p.sold_out, low: p.low, available_qty: p.available_qty })),
  }));

  // Ejecuta un cambio; si no se guarda, lo dice y la orden queda como estaba (FR-010).
  const run = async (work: () => Promise<unknown>) => {
    try {
      await work();
    } catch (failure) {
      haptic.warning();
      const occupied = failure instanceof ApiError && failure.code === "table_occupied";
      const offMenu = failure instanceof ApiError && failure.code === "not_on_menu";
      if (offMenu) void menuQuery.refetch();
      toast.error(occupied ? t("tables.occupied") : offMenu ? t("takeOrder.notOnMenu") : failure instanceof NetworkError ? t("check.notSaved") : describeError(failure));
      source.refetch();
    }
  };

  const pick = (tile: SourceTile) => {
    if (tile.selection) {
      setSelection(tile.selection);
      return;
    }
    if (tile.tableId == null) return;
    void run(async () => {
      setSelection(await source.create({ tableId: tile.tableId as number }));
    });
  };

  const createNamed = (name: string) =>
    run(async () => {
      setSelection(await source.create({ name }));
    });

  const send = async () => {
    // La hoja se cierra de inmediato al mandar: el resultado llega como aviso (spec 024).
    setSheetOpen(false);
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

  const deliver = (item: CheckItem) =>
    run(async () => {
      await source.deliver(item);
      haptic.success();
    });
  const confirmCancelItem = (item: CheckItem, reason: string) =>
    run(async () => {
      await source.cancelItem(item, reason);
      setView({ kind: "order" });
    });
  const pickWaiter = (waiterId: number) =>
    run(async () => {
      await source.reassign(waiterId);
      setView({ kind: "order" });
      toast.success(t("takeOrder.reassigned"));
    });

  // Una orden abierta se termina antes de cobrarla (R9).
  const doCharge = () => {
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

  // Con la hoja abierta, se cierra antes de abrir el cobro o la confirmación: iOS no abre un modal sobre otro.
  const afterSheet = (action: () => void) => {
    if (!sheetOpen) return action();
    setSheetOpen(false);
    setTimeout(action, 320);
  };
  const charge = () => afterSheet(doCharge);

  if (source.error) return <ErrorView error={undefined} onRetry={source.refetch} />;

  const current = source.current;
  const summary = orderSummary(current?.lines ?? []);
  const plan = (
    <Plan tiles={source.tiles} mode={mode} selection={selection} onPick={pick} onCreate={(name) => void createNamed(name)} creating={false} loading={source.loading} />
  );
  const orderPanel = (hideTitle: boolean) => (
    <OrderPanel
      current={current}
      loading={source.currentLoading}
      missing={source.currentMissing}
      busy={false}
      sending={sending}
      onQuantity={(line: Line, quantity: number) => void run(() => source.setQuantity(line, quantity))}
      canNote={!!current?.check}
      onRemove={(line: Line) => void run(() => source.remove(line))}
      onNote={(line: Line, note: string) => void run(async () => {
        await source.setNote(line, note);
        haptic.success();
      })}
      onAddMore={wide ? undefined : () => setSheetOpen(false)}
      onSend={() => void send()}
      onCharge={charge}
      onRelease={() => afterSheet(release)}
      onReassign={() => setView({ kind: "waiters" })}
      onDeliver={(item) => void deliver(item)}
      onCancelItem={(item) => setView({ kind: "cancel", item })}
      onViewTicket={current?.ticketId ? () => router.push(`/ticket/${current.ticketId}` as never) : undefined}
      hideTitle={hideTitle}
    />
  );
  // La hoja (y la columna de la tableta) muestra la orden o una de sus vistas secundarias.
  const panel = (hideTitle: boolean) =>
    view.kind === "cancel" ? (
      <CancelReasonForm name={view.item.name} busy={false} onConfirm={(reason) => void confirmCancelItem(view.item, reason)} onBack={() => setView({ kind: "order" })} />
    ) : view.kind === "waiters" ? (
      <WaiterList waiters={source.waiters} currentId={current?.check?.waiter?.id} loading={source.waitersLoading} onPick={(id) => void pickWaiter(id)} />
    ) : (
      orderPanel(hideTitle)
    );
  const sheetTitle =
    view.kind === "cancel" ? t("takeOrder.cancelItemTitle", { name: view.item.name }) : view.kind === "waiters" ? t("takeOrder.reassign") : t("takeOrder.orderSheetTitle", { name: current?.title ?? "" });
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
            {panel(false)}
          </ScrollView>
          <ScrollView style={{ flex: 1.2 }} contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 80 }} keyboardShouldPersistTaps="handled">
            {menuCards}
          </ScrollView>
        </View>
      ) : selection ? (
        <>
          <MenuHeader title={current?.title || t("takeOrder.title")} onChangeTable={() => { setSheetOpen(false); setSelection(null); }} />
          <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }} keyboardShouldPersistTaps="handled">
            {banner}
            {menuCards}
          </ScrollView>
          <OrderBar count={summary.count} total={summary.total} onPress={() => setSheetOpen(true)} />
          <OrderSheet visible={sheetOpen} title={sheetTitle} onClose={() => { setSheetOpen(false); setView({ kind: "order" }); }} onBack={view.kind === "order" ? undefined : () => setView({ kind: "order" })}>
            {panel(true)}
          </OrderSheet>
        </>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: TAB_BAR_HEIGHT + 80 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={source.refreshing} onRefresh={source.refetch} tintColor={c.primary} colors={[c.primary]} />}
        >
          {banner}
          {plan}
        </ScrollView>
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
