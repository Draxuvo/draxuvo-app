import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, type ReactNode } from "react";
import { RefreshControl, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import type { WorkOrderEvent } from "@/api/types";
import { EmptyState } from "@/components/empty-state";
import { ErrorView } from "@/components/error-view";
import { ProblemArt } from "@/components/illustrations";
import { Monogram } from "@/components/order-card";
import { NoteBox } from "@/components/note-box";
import { OrderActions } from "@/components/order-actions";
import { PhotoGrid } from "@/components/photo-grid";
import { SkeletonBlock } from "@/components/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { StepList } from "@/components/step-list";
import { StepsBar } from "@/components/steps-bar";
import { AppText, Icon, IconButton, KeyboardFrame } from "@/components/ui";
import { useOutbox } from "@/hooks/use-outbox";
import { useOrder, useToggleStep } from "@/hooks/use-orders";
import { t, useLocale } from "@/i18n";
import { toast } from "@/toast/store";
import { formatMoney } from "@/lib/money";
import { radius, rowEnter, sheetIn, space, useTheme } from "@/theme";

function Section({ title, index, children }: { title: string; index: number; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Animated.View entering={rowEnter(index + 1)} style={{ gap: space[2] }}>
      <AppText variant="label" tone="muted" accessibilityRole="header">
        {title.toUpperCase()}
      </AppText>
      <View style={{ backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: space[4], gap: space[2] }}>{children}</View>
    </Animated.View>
  );
}

const historyLine = (event: WorkOrderEvent) => t(`orders.history.${event.kind}`, { name: event.actor?.name ?? "" });

export default function OrderDetail() {
  useLocale();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const query = useOrder(orderId);
  const toggle = useToggleStep(orderId);
  const pending = useOutbox(orderId);
  const lastStatus = useRef<string | null>(null);

  const order = query.data;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/ordenes"));

  // Si el estado cambió por otra persona mientras mirabas la orden, se avisa (spec: edge case).
  useEffect(() => {
    if (!order) return;
    if (lastStatus.current && lastStatus.current !== order.status && !toggle.isPending) toast.info(t("orders.detail.conflict"));
    lastStatus.current = order.status;
  }, [order, toggle.isPending]);

  const onActionError = (error: unknown) => {
    if (error instanceof ApiError && [409, 422].includes(error.status)) {
      toast.info(t("orders.detail.conflict"));
      void query.refetch();
    }
  };

  const gone = query.error instanceof ApiError && [403, 404].includes(query.error.status);
  const allowed = order?.allowed_actions ?? [];

  const topBar = (
    <View style={{ paddingTop: insets.top + space[1], paddingHorizontal: space[2], flexDirection: "row", alignItems: "center", backgroundColor: c.background }}>
      <IconButton icon="arrow-left" label={t("common.back")} onPress={goBack} />
      <AppText variant="label" tone="muted" style={{ flex: 1 }}>
        {t("orders.detail.order", { id: orderId }).toUpperCase()}
      </AppText>
      {allowed.includes("edit") ? <IconButton icon="edit-2" label={t("orders.actions.edit")} onPress={() => router.push(`/orden-form/${orderId}` as never)} /> : null}
    </View>
  );

  if (gone) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {topBar}
        <EmptyState art={<ProblemArt />} title={t("orders.detail.gone")} actionLabel={t("orders.detail.back")} onAction={() => router.replace("/(tabs)/ordenes")} />
      </View>
    );
  }
  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {topBar}
        <View style={{ padding: space[4], gap: space[4] }}>
          <SkeletonBlock width="80%" height={32} />
          <SkeletonBlock width="30%" height={24} />
          <SkeletonBlock height={120} />
          <SkeletonBlock height={160} />
        </View>
      </View>
    );
  }
  if (query.isError || !order) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {topBar}
        <ErrorView error={query.error} onRetry={() => void query.refetch()} />
      </View>
    );
  }

  const pendingPhotos = pending.filter((item) => item.kind === "photo");
  const pendingNotes = pending.filter((item) => item.kind === "note");
  const events = order.events ?? [];
  const hasActions = ["start", "finish", "reopen", "charge"].some((a) => allowed.includes(a as never));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      {topBar}
      <KeyboardFrame>
<Animated.ScrollView
        contentContainerStyle={{ padding: space[4], gap: space[5], paddingBottom: hasActions ? 150 + insets.bottom : space[10] + insets.bottom }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={c.primary} colors={[c.primary]} />}
      >
        <Animated.View entering={rowEnter(0)} style={{ gap: space[3] }}>
          <StatusBadge status={order.status} animate />
          <AppText variant="display" accessibilityRole="header">
            {order.title}
          </AppText>
          {order.description ? <AppText variant="bodyLarge">{order.description}</AppText> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
            {order.employee ? <Monogram name={order.employee.name} size={32} /> : <Icon name="user-x" tone="muted" />}
            <AppText tone="muted">{order.employee?.name ?? t("orders.unassigned")}</AppText>
            {order.due_date ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Icon name="calendar" size={16} tone="muted" />
                <AppText tone="muted">{t("orders.detail.due", { date: order.due_date })}</AppText>
              </View>
            ) : null}
          </View>
          {order.customer_name ? (
            <AppText tone="muted">
              {t("orders.detail.customer")}: {order.customer_name}
            </AppText>
          ) : null}
          {order.steps_count > 0 ? (
            <View style={{ gap: space[1] }}>
              <StepsBar done={order.steps_done} total={order.steps_count} />
              <AppText variant="label" tone="muted" style={{ letterSpacing: 0.2 }}>
                {t("orders.progress", { done: order.steps_done, total: order.steps_count })}
              </AppText>
            </View>
          ) : null}
        </Animated.View>

        {order.steps_count > 0 || (order.steps ?? []).length > 0 ? (
          <Section title={t("orders.detail.steps")} index={0}>
            <StepList
              steps={order.steps ?? []}
              canCheck={allowed.includes("check_steps")}
              busyStepId={toggle.isPending ? toggle.variables?.stepId : null}
              onToggle={(step) => toggle.mutate({ stepId: step.id, done: !step.done }, { onError: onActionError })}
            />
          </Section>
        ) : null}

        {(order.items ?? []).length > 0 ? (
          <Section title={t("orders.detail.items")} index={1}>
            {(order.items ?? []).map((item) => (
              <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
                <AppText style={{ flexShrink: 1 }}>
                  {Number(item.quantity)} × {item.description}
                </AppText>
                {item.subtotal != null ? <AppText variant="bodyStrong">{formatMoney(item.subtotal)}</AppText> : null}
              </View>
            ))}
            {order.total != null ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: 1, borderTopColor: c.line, paddingTop: space[3], marginTop: space[1] }}>
                <AppText variant="label" tone="muted">
                  {t("orders.detail.total").toUpperCase()}
                </AppText>
                <AppText variant="figure">{formatMoney(order.total)}</AppText>
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section title={t("orders.detail.photos")} index={2}>
          <PhotoGrid orderId={order.id} canAdd={allowed.includes("add_photo")} photos={order.photos ?? []} pending={pendingPhotos} />
        </Section>

        <Section title={t("orders.detail.notes")} index={3}>
          <NoteBox orderId={order.id} canAdd={allowed.includes("add_note")} events={events} pending={pendingNotes} />
        </Section>

        <Section title={t("orders.detail.history")} index={4}>
          {events
            .filter((event) => event.kind !== "note")
            .map((event) => (
              <View key={event.id} style={{ flexDirection: "row", gap: space[2], alignItems: "center" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
                <AppText tone="muted" style={{ flex: 1 }}>
                  {historyLine(event)}
                </AppText>
              </View>
            ))}
        </Section>
      </Animated.ScrollView>
</KeyboardFrame>

      {hasActions ? (
        <Animated.View
          entering={sheetIn}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: c.surface,
            borderTopWidth: 1,
            borderTopColor: c.line,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingHorizontal: space[4],
            paddingTop: space[4],
            paddingBottom: insets.bottom + space[4],
          }}
        >
          <OrderActions order={order} onError={onActionError} />
        </Animated.View>
      ) : null}
    </View>
  );
}
