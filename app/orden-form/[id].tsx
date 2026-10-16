import { useQuery } from "@tanstack/react-query";
import { KeyboardFrame } from "@/components/ui";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { ApiError } from "@/api/client";
import { createOrder, getMenu, updateOrder } from "@/api/orders";
import { EmptyState } from "@/components/empty-state";
import { ErrorView } from "@/components/error-view";
import { ProblemArt } from "@/components/illustrations";
import { OrderForm } from "@/components/order-form";
import { EMPTY_FORM, fromOrder, toPayload, type OrderFormValues } from "@/components/order-form-schema";
import { SkeletonBlock } from "@/components/skeleton";
import { useApplyOrder, useEmployees, useKeys, useOrder } from "@/hooks/use-orders";
import { haptic } from "@/lib/haptics";
import { t, useLocale } from "@/i18n";
import { isBossRole, useSession } from "@/session";
import { rowEnter, space, useTheme } from "@/theme";

export default function OrdenForm() {
  useLocale();
  const { c } = useTheme();
  const router = useRouter();
  const keys = useKeys();
  const apply = useApplyOrder();
  const { user, companyId, role } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = id === "nueva" ? null : Number(id);
  const mode = user?.companies.find((company) => company.id === companyId)?.order_mode ?? "service";
  const boss = isBossRole(role);

  const order = useOrder(orderId ?? 0, orderId != null);
  const employees = useEmployees(boss);
  const menu = useQuery({ queryKey: [...keys.all, "menu"], queryFn: getMenu, enabled: boss && mode === "order" });
  const [submitting, setSubmitting] = useState(false);
  const [apiErrors, setApiErrors] = useState<string[]>([]);

  const title = <Stack.Screen options={{ title: orderId == null ? t("orderForm.titleNew") : t("orderForm.titleEdit") }} />;

  // El staff no crea ni edita: la API también lo niega, aquí solo se evita mostrar el formulario.
  if (!boss) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background }}>
        {title}
        <EmptyState art={<ProblemArt />} title={t("orderForm.forbidden")} actionLabel={t("orders.detail.back")} onAction={() => router.replace("/(tabs)/ordenes")} />
      </View>
    );
  }

  const loading = (orderId != null && order.isLoading) || (mode === "order" && menu.isLoading);
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.background, padding: space[4], gap: space[4] }}>
        {title}
        <SkeletonBlock height={54} />
        <SkeletonBlock height={54} />
        <SkeletonBlock height={120} />
      </View>
    );
  }
  if (orderId != null && (order.isError || !order.data)) return <ErrorView error={order.error} onRetry={() => void order.refetch()} />;

  const initial: OrderFormValues = orderId != null && order.data ? fromOrder(order.data) : EMPTY_FORM;

  const submit = async (values: OrderFormValues) => {
    setSubmitting(true);
    setApiErrors([]);
    try {
      const payload = toPayload(values, mode);
      const saved = orderId == null ? await createOrder(payload) : await updateOrder(orderId, payload);
      haptic.success();
      apply(saved);
      router.replace(orderId == null ? "/(tabs)/ordenes" : (`/ordenes/${saved.id}` as never));
    } catch (error) {
      haptic.warning();
      if (error instanceof ApiError && (error.status === 422 || error.status === 400)) {
        setApiErrors(Array.isArray(error.details) ? (error.details as string[]) : [typeof error.details === "string" ? error.details : error.message]);
      } else {
        setApiErrors([error instanceof ApiError ? error.message : t("errors.network")]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardFrame>
<Animated.ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space[4], paddingBottom: space[10] }} keyboardShouldPersistTaps="handled">
      {title}
      <Animated.View entering={rowEnter(0)}>
        <OrderForm
          mode={mode}
          initial={initial}
          employees={employees.data?.results ?? []}
          menu={menu.data?.menu ?? []}
          editing={orderId != null}
          submitting={submitting}
          apiErrors={apiErrors}
          onSubmit={(values) => void submit(values)}
        />
      </Animated.View>
    </Animated.ScrollView>
</KeyboardFrame>
  );
}
