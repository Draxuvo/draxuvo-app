import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { ApiError } from "@/api/client";
import type { WorkOrderEvent } from "@/api/types";
import { ErrorView } from "@/components/error-view";
import { NoteBox } from "@/components/note-box";
import { OrderActions } from "@/components/order-actions";
import { PhotoGrid } from "@/components/photo-grid";
import { StatusBadge } from "@/components/status-badge";
import { StepList } from "@/components/step-list";
import { AppText, Button, Card } from "@/components/ui";
import { useOutbox } from "@/hooks/use-outbox";
import { useOrder, useToggleStep } from "@/hooks/use-orders";
import { t, useLocale } from "@/i18n";
import { colors, spacing } from "@/theme";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </Card>
  );
}

const historyLine = (event: WorkOrderEvent) =>
  t(`orders.history.${event.kind}`, { name: event.actor?.name ?? "" });

export default function OrderDetail() {
  useLocale();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const query = useOrder(orderId);
  const toggle = useToggleStep(orderId);
  const pending = useOutbox(orderId);
  const [conflict, setConflict] = useState(false);
  const lastStatus = useRef<string | null>(null);

  const order = query.data;

  // Si el estado cambió por otra persona mientras mirabas la orden, se avisa (spec: edge case).
  useEffect(() => {
    if (!order) return;
    if (lastStatus.current && lastStatus.current !== order.status && !toggle.isPending) setConflict(true);
    lastStatus.current = order.status;
  }, [order, toggle.isPending]);

  const onActionError = (error: unknown) => {
    if (error instanceof ApiError && [409, 422].includes(error.status)) {
      setConflict(true);
      void query.refetch();
    }
  };

  const gone = query.error instanceof ApiError && [403, 404].includes(query.error.status);

  if (gone) {
    return (
      <View style={{ flex: 1, padding: spacing[6], gap: spacing[4], backgroundColor: colors.anaquel }}>
        <AppText variant="title">{t("orders.detail.gone")}</AppText>
        <Button label={t("orders.detail.back")} onPress={() => router.replace("/(tabs)/ordenes")} />
      </View>
    );
  }
  if (query.isLoading) return <ActivityIndicator color={colors.tinta} style={{ marginTop: spacing[8] }} />;
  if (query.isError || !order) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;

  const allowed = order.allowed_actions ?? [];
  const pendingPhotos = pending.filter((item) => item.kind === "photo");
  const pendingNotes = pending.filter((item) => item.kind === "note");
  const events = order.events ?? [];

  return (
    <ScrollView
      style={{ backgroundColor: colors.anaquel }}
      contentContainerStyle={{ padding: spacing[4], gap: spacing[3] }}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
    >
      {conflict ? (
        <Card>
          <AppText accessibilityRole="alert" testID="order-conflict">
            {t("orders.detail.conflict")}
          </AppText>
          <Button label={t("common.close")} variant="outline" onPress={() => setConflict(false)} />
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing[2] }}>
          <AppText variant="headline" style={{ flexShrink: 1 }} accessibilityRole="header">
            {order.title}
          </AppText>
          <StatusBadge status={order.status} />
        </View>
        {order.description ? <AppText>{order.description}</AppText> : null}
        <AppText muted>{order.employee?.name ?? t("orders.unassigned")}</AppText>
        {order.customer_name ? (
          <AppText muted>
            {t("orders.detail.customer")}: {order.customer_name}
          </AppText>
        ) : null}
        {order.due_date ? <AppText muted>{t("orders.detail.due", { date: order.due_date })}</AppText> : null}
      </Card>

      <OrderActions order={order} onError={onActionError} />

      {order.steps_count > 0 || (order.steps ?? []).length > 0 ? (
        <Section title={`${t("orders.detail.steps")} · ${t("orders.progress", { done: order.steps_done, total: order.steps_count })}`}>
          <StepList
            steps={order.steps ?? []}
            canCheck={allowed.includes("check_steps")}
            busyStepId={toggle.isPending ? toggle.variables?.stepId : null}
            onToggle={(step) => toggle.mutate({ stepId: step.id, done: !step.done }, { onError: onActionError })}
          />
        </Section>
      ) : null}

      {(order.items ?? []).length > 0 ? (
        <Section title={t("orders.detail.items")}>
          {(order.items ?? []).map((item) => (
            <View key={item.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText style={{ flexShrink: 1 }}>
                {item.quantity} × {item.description}
              </AppText>
              {item.subtotal != null ? <AppText variant="bodyStrong">${item.subtotal.toFixed(2)}</AppText> : null}
            </View>
          ))}
          {order.total != null ? (
            <AppText variant="bodyStrong">
              {t("orders.detail.total")}: ${Number(order.total).toFixed(2)}
            </AppText>
          ) : null}
        </Section>
      ) : null}

      <Section title={t("orders.detail.photos")}>
        <PhotoGrid orderId={order.id} canAdd={allowed.includes("add_photo")} photos={order.photos ?? []} pending={pendingPhotos} />
      </Section>

      <Section title={t("orders.detail.notes")}>
        <NoteBox orderId={order.id} canAdd={allowed.includes("add_note")} events={events} pending={pendingNotes} />
      </Section>

      <Section title={t("orders.detail.history")}>
        {events
          .filter((event) => event.kind !== "note")
          .map((event) => (
            <AppText key={event.id} variant="label" muted>
              {historyLine(event)}
            </AppText>
          ))}
      </Section>
    </ScrollView>
  );
}
