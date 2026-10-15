import { api } from "./client";
import type {
  Employee,
  MenuGroup,
  PaginatedResponse,
  PaymentMethod,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
} from "./types";

export interface OrderListParams {
  page?: number;
  status?: WorkOrderStatus;
  employee_id?: number;
  search?: string;
  sort_by?: "urgency" | "created_at" | "due_date";
}

export const listOrders = ({ page = 1, ...rest }: OrderListParams = {}) =>
  api.get<PaginatedResponse<WorkOrder>>("/api/v1/work_orders", { query: { page, page_size: 20, ...rest } });

export const getOrder = (id: number) => api.get<WorkOrder>(`/api/v1/work_orders/${id}`);

export type OrderTransition = "start" | "finish" | "reopen" | "cancel" | "charge" | "void_charge";

export interface ChargeBody {
  payment_method: PaymentMethod;
  amount_received?: number;
}

export const transitionOrder = (id: number, action: OrderTransition, body: Record<string, unknown> = {}) =>
  api.post<WorkOrder>(`/api/v1/work_orders/${id}/${action}`, { body });

export const chargeOrder = (id: number, body: ChargeBody) => transitionOrder(id, "charge", { ...body });

export const setStepDone = (orderId: number, stepId: number, done: boolean) =>
  api.patch<WorkOrder>(`/api/v1/work_orders/${orderId}/steps/${stepId}`, { body: { done } });

export interface OrderPayload {
  work_order: {
    title: string;
    description?: string;
    priority?: WorkOrderPriority;
    due_date?: string | null;
    employee_id?: number | null;
    customer_name?: string;
    customer_phone?: string;
    customer_address?: string;
  };
  items?: { description?: string; quantity: number; unit_price?: number; unit?: string; product_id?: number }[];
  steps?: { description: string }[];
}

export const createOrder = (payload: OrderPayload) =>
  api.post<WorkOrder>("/api/v1/work_orders", { body: payload });

export const updateOrder = (id: number, payload: OrderPayload) =>
  api.patch<WorkOrder>(`/api/v1/work_orders/${id}`, { body: payload });

export const listEmployees = () =>
  api.get<PaginatedResponse<Employee>>("/api/v1/employees", { query: { page_size: 100, status: "active" } });

export const getMenu = () => api.get<MenuGroup[]>("/api/v1/products/menu");

/** Notas y fotos salen por la cola con `Idempotency-Key` (contrato: reenviar no duplica). */
export const postNote = (orderId: number, text: string, idempotencyKey: string) =>
  api.post<WorkOrder>(`/api/v1/work_orders/${orderId}/notes`, {
    body: { text },
    headers: { "Idempotency-Key": idempotencyKey },
  });

export interface PhotoFile {
  uri: string;
  name: string;
  type: string;
}

/** Los archivos de React Native se adjuntan como `{ uri, name, type }`, no como Blob. */
export function fileField(file: PhotoFile): Blob {
  return file as unknown as Blob;
}

export const postPhoto = (orderId: number, file: PhotoFile, description: string | undefined, idempotencyKey: string) => {
  const form = new FormData();
  form.append("file", fileField(file));
  if (description) form.append("description", description);
  return api.post<WorkOrder>(`/api/v1/work_orders/${orderId}/photos`, {
    form,
    headers: { "Idempotency-Key": idempotencyKey },
  });
};
