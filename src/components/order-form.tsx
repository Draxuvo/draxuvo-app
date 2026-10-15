import { useState } from "react";
import { Pressable, View } from "react-native";
import type { Employee, MenuGroup, OrderMode, WorkOrderPriority } from "@/api/types";
import { t } from "@/i18n";
import { colors, MIN_TOUCH, radii, spacing } from "@/theme";
import {
  hasErrors,
  validateOrderForm,
  type ItemRow,
  type OrderFormErrors,
  type OrderFormValues,
} from "./order-form-schema";
import { AppText, Button, Card, Field } from "./ui";

const PRIORITIES: WorkOrderPriority[] = ["low", "medium", "high", "urgent"];

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: MIN_TOUCH,
        justifyContent: "center",
        paddingHorizontal: spacing[3],
        borderRadius: radii.pastilla,
        borderWidth: 1.5,
        borderColor: selected ? colors.tinta : colors.anaquelBorde,
        backgroundColor: selected ? colors.tinta : colors.etiqueta,
      }}
    >
      <AppText variant="bodyStrong" style={{ color: selected ? colors.etiqueta : colors.tinta }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const err = (key?: string) => (key ? t(`orderForm.errors.${key}`) : null);

/**
 * Formulario de orden. En modo pedido: mesa y productos del menú. En modo servicio: cliente,
 * prioridad, fecha, pasos y conceptos (FR-025).
 */
export function OrderForm({
  mode,
  initial,
  employees,
  menu,
  editing,
  submitting,
  apiErrors,
  onSubmit,
}: {
  mode: OrderMode;
  initial: OrderFormValues;
  employees: Employee[];
  menu: MenuGroup[];
  editing: boolean;
  submitting: boolean;
  /** Mensajes que devolvió la API (por ejemplo, un 422). */
  apiErrors: string[];
  onSubmit: (values: OrderFormValues) => void;
}) {
  const [values, setValues] = useState<OrderFormValues>(initial);
  const [errors, setErrors] = useState<OrderFormErrors>({ items: {} });
  const patch = (changes: Partial<OrderFormValues>) => setValues((current) => ({ ...current, ...changes }));
  const patchItem = (index: number, changes: Partial<ItemRow>) =>
    patch({ items: values.items.map((row, i) => (i === index ? { ...row, ...changes } : row)) });
  const isOrder = mode === "order";

  const submit = () => {
    const found = validateOrderForm(values, mode);
    setErrors(found);
    if (!hasErrors(found)) onSubmit(values);
  };

  const addMenuProduct = (product: MenuGroup["items"][number]) => {
    const existing = values.items.findIndex((row) => row.productId === product.id);
    if (existing >= 0) return patchItem(existing, { quantity: String(Number(values.items[existing].quantity) + 1) });
    patch({
      items: [
        ...values.items,
        { productId: product.id, description: product.name, unit: product.unit, quantity: "1", unitPrice: String(product.price ?? "") },
      ],
    });
  };

  return (
    <View style={{ gap: spacing[4] }}>
      {apiErrors.length ? (
        <Card>
          {apiErrors.map((message) => (
            <AppText key={message} style={{ color: colors.alerta }} accessibilityRole="alert">
              {message}
            </AppText>
          ))}
        </Card>
      ) : null}

      <Field
        label={isOrder ? t("orderForm.table") : t("orderForm.title")}
        value={values.title}
        onChangeText={(title) => patch({ title })}
        error={err(errors.title)}
        testID="form-title"
      />

      {employees.length > 0 ? (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="label" muted>
            {t("orderForm.assignee").toUpperCase()}
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
            <Chip label={t("orderForm.unassigned")} selected={values.employeeId == null} onPress={() => patch({ employeeId: null })} />
            {employees.map((employee) => (
              <Chip key={employee.id} label={employee.name} selected={values.employeeId === employee.id} onPress={() => patch({ employeeId: employee.id })} />
            ))}
          </View>
        </View>
      ) : null}

      {!isOrder ? (
        <>
          <View style={{ gap: spacing[2] }}>
            <AppText variant="label" muted>
              {t("orderForm.priority").toUpperCase()}
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
              {PRIORITIES.map((priority) => (
                <Chip key={priority} label={t(`orders.priority.${priority}`)} selected={values.priority === priority} onPress={() => patch({ priority })} />
              ))}
            </View>
          </View>
          <Field label={t("orderForm.dueDate")} value={values.dueDate} onChangeText={(dueDate) => patch({ dueDate })} error={err(errors.dueDate)} keyboardType="numbers-and-punctuation" autoCorrect={false} />
          <Field label={t("orderForm.customerName")} value={values.customerName} onChangeText={(customerName) => patch({ customerName })} />
          <Field label={t("orderForm.customerPhone")} value={values.customerPhone} onChangeText={(customerPhone) => patch({ customerPhone })} error={err(errors.customerPhone)} keyboardType="phone-pad" testID="form-phone" />
          <Field label={t("orderForm.customerAddress")} value={values.customerAddress} onChangeText={(customerAddress) => patch({ customerAddress })} />
          <Field label={t("orderForm.notes")} value={values.notes} onChangeText={(notes) => patch({ notes })} multiline />

          <View style={{ gap: spacing[2] }}>
            <AppText variant="title">{t("orderForm.steps")}</AppText>
            {values.steps.map((step, index) => (
              <View key={index} style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={`${t("orderForm.steps")} ${index + 1}`}
                    placeholder={t("orderForm.stepPlaceholder")}
                    value={step.description}
                    onChangeText={(description) => patch({ steps: values.steps.map((s, i) => (i === index ? { ...s, description } : s)) })}
                  />
                </View>
                <Button label={t("orderForm.remove")} variant="outline" onPress={() => patch({ steps: values.steps.filter((_, i) => i !== index) })} />
              </View>
            ))}
            <Button label={t("orderForm.addStep")} variant="outline" onPress={() => patch({ steps: [...values.steps, { description: "" }] })} />
          </View>
        </>
      ) : (
        <View style={{ gap: spacing[2] }}>
          <AppText variant="title">{t("orderForm.menu")}</AppText>
          {menu.map((group) => (
            <View key={group.category} style={{ gap: spacing[2] }}>
              <AppText variant="label" muted>
                {group.category.toUpperCase()}
              </AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
                {group.items.map((product) => (
                  <Chip key={product.id} label={product.name} selected={false} onPress={() => addMenuProduct(product)} />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ gap: spacing[3] }}>
        <AppText variant="title">{t("orderForm.items")}</AppText>
        {values.items.map((row, index) => (
          <Card key={`${row.productId ?? "x"}-${index}`}>
            <Field
              label={t("orderForm.itemDescription")}
              value={row.description}
              onChangeText={(description) => patchItem(index, { description })}
              error={err(errors.items[index]?.description)}
            />
            <View style={{ flexDirection: "row", gap: spacing[2] }}>
              <View style={{ flex: 1 }}>
                <Field label={t("orderForm.quantity")} value={row.quantity} onChangeText={(quantity) => patchItem(index, { quantity })} keyboardType="decimal-pad" error={err(errors.items[index]?.quantity)} testID={`form-qty-${index}`} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t("orderForm.price")} value={row.unitPrice} onChangeText={(unitPrice) => patchItem(index, { unitPrice })} keyboardType="decimal-pad" error={err(errors.items[index]?.unitPrice)} />
              </View>
            </View>
            <Button label={t("orderForm.remove")} variant="outline" onPress={() => patch({ items: values.items.filter((_, i) => i !== index) })} />
          </Card>
        ))}
        {!isOrder ? (
          <Button
            label={t("orderForm.addItem")}
            variant="outline"
            onPress={() => patch({ items: [...values.items, { description: "", quantity: "1", unitPrice: "" }] })}
          />
        ) : null}
      </View>

      <Button label={editing ? t("orderForm.submitSave") : t("orderForm.submitCreate")} onPress={submit} loading={submitting} />
    </View>
  );
}
