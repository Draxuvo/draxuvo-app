import type { OrderPayload } from "@/api/orders";
import type { OrderMode, WorkOrder, WorkOrderPriority } from "@/api/types";
import { parseMoney } from "@/lib/money";

export interface ItemRow {
  id?: number;
  productId?: number;
  description: string;
  unit?: string;
  quantity: string;
  unitPrice: string;
}

export interface OrderFormValues {
  title: string;
  employeeId: number | null;
  priority: WorkOrderPriority;
  dueDate: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  items: ItemRow[];
  steps: { id?: number; description: string }[];
}

export interface ItemErrors {
  description?: string;
  quantity?: string;
  unitPrice?: string;
}

export interface OrderFormErrors {
  title?: string;
  customerPhone?: string;
  dueDate?: string;
  items: Record<number, ItemErrors>;
}

export const EMPTY_FORM: OrderFormValues = {
  title: "",
  employeeId: null,
  priority: "medium",
  dueDate: "",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  notes: "",
  items: [],
  steps: [],
};

export function fromOrder(order: WorkOrder): OrderFormValues {
  return {
    title: order.title,
    employeeId: order.employee?.id ?? null,
    priority: order.priority,
    dueDate: order.due_date?.slice(0, 10) ?? "",
    customerName: order.customer_name ?? "",
    customerPhone: order.customer_phone ?? "",
    customerAddress: order.customer_address ?? "",
    notes: order.notes ?? "",
    items: (order.items ?? []).map((item) => ({
      id: item.id,
      productId: item.product_id,
      description: item.description,
      unit: item.unit,
      quantity: String(item.quantity),
      unitPrice: item.unit_price != null ? String(item.unit_price) : "",
    })),
    steps: (order.steps ?? []).map((step) => ({ id: step.id, description: step.description })),
  };
}

const PHONE = /^[\d\s()+-]{7,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Los mensajes son claves de `orderForm.errors.*`; la pantalla las traduce. */
export function validateOrderForm(values: OrderFormValues, mode: OrderMode, staff = false): OrderFormErrors {
  const errors: OrderFormErrors = { items: {} };
  if (!values.title.trim()) errors.title = mode === "order" ? "tableRequired" : "titleRequired";

  if (mode === "service") {
    if (values.customerPhone.trim() && !PHONE.test(values.customerPhone.trim())) errors.customerPhone = "phoneInvalid";
    if (!staff && values.dueDate.trim() && (!DATE.test(values.dueDate.trim()) || Number.isNaN(Date.parse(values.dueDate.trim())))) errors.dueDate = "dueInvalid";
  }

  values.items.forEach((row, index) => {
    const rowErrors: ItemErrors = {};
    if (!row.description.trim() || (staff && !row.productId)) rowErrors.description = "descriptionRequired";
    const quantity = Number(row.quantity);
    if (!(quantity > 0)) rowErrors.quantity = "quantityInvalid";
    if (row.unitPrice.trim() !== "" && parseMoney(row.unitPrice) == null) rowErrors.unitPrice = "priceInvalid";
    if (Object.keys(rowErrors).length) errors.items[index] = rowErrors;
  });
  return errors;
}

export function hasErrors(errors: OrderFormErrors): boolean {
  return !!(errors.title || errors.customerPhone || errors.dueDate || Object.keys(errors.items).length);
}

/** Pedido: mesa y productos del menú, sin pasos. Servicio: cliente, prioridad, fecha y pasos (FR-025). */
export function toPayload(values: OrderFormValues, mode: OrderMode): OrderPayload {
  const work_order: OrderPayload["work_order"] = { title: values.title.trim(), employee_id: values.employeeId };
  if (mode === "service") {
    Object.assign(work_order, {
      customer_name: values.customerName.trim() || null,
      customer_phone: values.customerPhone.trim() || null,
      customer_address: values.customerAddress.trim() || null,
      priority: values.priority,
      due_date: values.dueDate.trim() || null,
      notes: values.notes.trim() || null,
    });
  }
  const payload: OrderPayload = {
    work_order,
    items: values.items.map((row, position) => ({
      ...(row.id ? { id: row.id } : {}),
      ...(row.productId ? { product_id: row.productId } : {}),
      description: row.description.trim(),
      ...(row.unit ? { unit: row.unit } : {}),
      quantity: Number(row.quantity),
      ...(row.unitPrice.trim() !== "" ? { unit_price: parseMoney(row.unitPrice) ?? 0 } : {}),
      position,
    })) as OrderPayload["items"],
  };
  if (mode === "service") {
    payload.steps = values.steps
      .filter((step) => step.description.trim())
      .map((step, position) => ({ ...(step.id ? { id: step.id } : {}), description: step.description.trim(), position })) as OrderPayload["steps"];
  }
  return payload;
}

/** El operador (spec 015) manda solo qué es, el cliente y productos del catálogo con cantidad. */
export function toStaffPayload(values: OrderFormValues, mode: OrderMode): OrderPayload {
  const work_order: OrderPayload["work_order"] = { title: values.title.trim() };
  if (mode === "service") {
    Object.assign(work_order, {
      customer_name: values.customerName.trim() || null,
      customer_phone: values.customerPhone.trim() || null,
    });
  }
  return {
    work_order,
    items: values.items
      .filter((row) => row.productId)
      .map((row) => ({ product_id: row.productId, quantity: Number(row.quantity) })) as OrderPayload["items"],
  };
}
