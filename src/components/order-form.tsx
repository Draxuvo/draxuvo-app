import { useState } from "react";
import { View } from "react-native";
import type { Employee, MenuGroup, OrderMode, WorkOrderPriority } from "@/api/types";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import {
  hasErrors,
  validateOrderForm,
  type ItemRow,
  type OrderFormErrors,
  type OrderFormValues,
} from "./order-form-schema";
import { AppText, Button, Card, Chip, Field } from "./ui";

const PRIORITIES: WorkOrderPriority[] = ["low", "medium", "high", "urgent"];

const err = (key?: string) => (key ? t(`orderForm.errors.${key}`) : null);

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <AppText variant="label" tone="muted">
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

/**
 * Formulario de orden. En modo pedido: mesa y productos del menú. En modo servicio: cliente,
 * prioridad, fecha, pasos y conceptos (FR-025). Con `staff` (spec 015) el operador crea su propia orden:
 * título, cliente y productos del catálogo con cantidad; la API la asigna y pone los precios.
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
  staff = false,
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
  staff?: boolean;
}) {
  const { c } = useTheme();
  const [values, setValues] = useState<OrderFormValues>(initial);
  const [errors, setErrors] = useState<OrderFormErrors>({ items: {} });
  const patch = (changes: Partial<OrderFormValues>) => setValues((current) => ({ ...current, ...changes }));
  const patchItem = (index: number, changes: Partial<ItemRow>) =>
    patch({ items: values.items.map((row, i) => (i === index ? { ...row, ...changes } : row)) });
  const isOrder = mode === "order";

  const submit = () => {
    const found = validateOrderForm(values, mode, staff);
    setErrors(found);
    if (hasErrors(found)) return haptic.warning();
    onSubmit(values);
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
    <View style={{ gap: space[5] }}>
      {apiErrors.length ? (
        <View style={{ backgroundColor: c.stampSoft, borderRadius: radius.field, padding: space[3], gap: space[1] }}>
          {apiErrors.map((message) => (
            <AppText key={message} style={{ color: c.onStampSoft }} accessibilityRole="alert">
              {message}
            </AppText>
          ))}
        </View>
      ) : null}

      <Field
        label={isOrder ? t("orderForm.table") : t("orderForm.title")}
        value={values.title}
        onChangeText={(title) => patch({ title })}
        error={err(errors.title)}
        testID="form-title"
      />

      {employees.length > 0 ? (
        <Group title={t("orderForm.assignee")}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            <Chip label={t("orderForm.unassigned")} selected={values.employeeId == null} onPress={() => patch({ employeeId: null })} />
            {employees.map((employee) => (
              <Chip key={employee.id} label={employee.name} selected={values.employeeId === employee.id} onPress={() => patch({ employeeId: employee.id })} />
            ))}
          </View>
        </Group>
      ) : null}

      {staff ? (
        <>
          {!isOrder ? (
            <>
              <Field label={t("orderForm.customerName")} icon="user" value={values.customerName} onChangeText={(customerName) => patch({ customerName })} />
              <Field label={t("orderForm.customerPhone")} icon="phone" value={values.customerPhone} onChangeText={(customerPhone) => patch({ customerPhone })} error={err(errors.customerPhone)} keyboardType="phone-pad" testID="form-phone" />
            </>
          ) : null}
          <MenuChips menu={menu} onPick={addMenuProduct} />
        </>
      ) : !isOrder ? (
        <>
          <Group title={t("orderForm.priority")}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
              {PRIORITIES.map((priority) => (
                <Chip key={priority} label={t(`orders.priority.${priority}`)} selected={values.priority === priority} onPress={() => patch({ priority })} />
              ))}
            </View>
          </Group>
          <Field label={t("orderForm.dueDate")} icon="calendar" value={values.dueDate} onChangeText={(dueDate) => patch({ dueDate })} error={err(errors.dueDate)} keyboardType="numbers-and-punctuation" autoCorrect={false} />
          <Field label={t("orderForm.customerName")} icon="user" value={values.customerName} onChangeText={(customerName) => patch({ customerName })} />
          <Field label={t("orderForm.customerPhone")} icon="phone" value={values.customerPhone} onChangeText={(customerPhone) => patch({ customerPhone })} error={err(errors.customerPhone)} keyboardType="phone-pad" testID="form-phone" />
          <Field label={t("orderForm.customerAddress")} icon="map-pin" value={values.customerAddress} onChangeText={(customerAddress) => patch({ customerAddress })} />
          <Field label={t("orderForm.notes")} value={values.notes} onChangeText={(notes) => patch({ notes })} multiline style={{ minHeight: 64, textAlignVertical: "top" }} />

          <Group title={t("orderForm.steps")}>
            {values.steps.map((step, index) => (
              <View key={index} style={{ flexDirection: "row", gap: space[2], alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={`${t("orderForm.steps")} ${index + 1}`}
                    placeholder={t("orderForm.stepPlaceholder")}
                    value={step.description}
                    onChangeText={(description) => patch({ steps: values.steps.map((s, i) => (i === index ? { ...s, description } : s)) })}
                  />
                </View>
                <Button label={t("orderForm.remove")} variant="danger" icon="trash-2" onPress={() => patch({ steps: values.steps.filter((_, i) => i !== index) })} />
              </View>
            ))}
            <Button label={t("orderForm.addStep")} variant="tonal" icon="plus" onPress={() => patch({ steps: [...values.steps, { description: "" }] })} />
          </Group>
        </>
      ) : (
        <MenuChips menu={menu} onPick={addMenuProduct} />
      )}

      <Group title={t("orderForm.items")}>
        {values.items.map((row, index) => (
          <Card key={`${row.productId ?? "x"}-${index}`} style={{ gap: space[3] }}>
            {staff ? (
              <AppText variant="bodyStrong">{row.description}</AppText>
            ) : (
              <Field
                label={t("orderForm.itemDescription")}
                value={row.description}
                onChangeText={(description) => patchItem(index, { description })}
                error={err(errors.items[index]?.description)}
              />
            )}
            <View style={{ flexDirection: "row", gap: space[2] }}>
              <View style={{ flex: 1 }}>
                <Field label={t("orderForm.quantity")} value={row.quantity} onChangeText={(quantity) => patchItem(index, { quantity })} keyboardType="decimal-pad" error={err(errors.items[index]?.quantity)} testID={`form-qty-${index}`} />
              </View>
              {!staff ? (
                <View style={{ flex: 1 }}>
                  <Field label={t("orderForm.price")} value={row.unitPrice} onChangeText={(unitPrice) => patchItem(index, { unitPrice })} keyboardType="decimal-pad" error={err(errors.items[index]?.unitPrice)} />
                </View>
              ) : null}
            </View>
            <Button label={t("orderForm.remove")} variant="danger" icon="trash-2" onPress={() => patch({ items: values.items.filter((_, i) => i !== index) })} />
          </Card>
        ))}
        {!isOrder && !staff ? (
          <Button
            label={t("orderForm.addItem")}
            variant="tonal"
            icon="plus"
            onPress={() => patch({ items: [...values.items, { description: "", quantity: "1", unitPrice: "" }] })}
          />
        ) : null}
      </Group>

      <Button label={editing ? t("orderForm.submitSave") : t("orderForm.submitCreate")} icon="check" onPress={submit} loading={submitting} />
    </View>
  );
}

function MenuChips({ menu, onPick }: { menu: MenuGroup[]; onPick: (product: MenuGroup["items"][number]) => void }) {
  return (
    <Group title={t("orderForm.menu")}>
      {menu.map((group) => (
        <View key={group.category} style={{ gap: space[2] }}>
          <AppText variant="bodyStrong">{group.category}</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {group.items.map((product) => (
              <Chip key={product.id} icon="plus" label={product.name} selected={false} onPress={() => onPick(product)} />
            ))}
          </View>
        </View>
      ))}
    </Group>
  );
}
