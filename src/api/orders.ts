import { api, ApiError } from "./client";
import type {
  ChargePaymentInput,
  Employee,
  MenuGroup,
  PaginatedResponse,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
} from "./types";

export interface OrderListParams {
  page?: number;
  status?: WorkOrderStatus;
  employee_id?: number;
  search?: string;
  /** Cobradas ese día (yyyy-MM-dd), junto con `status=paid`. */
  paid_on?: string;
  page_size?: number;
  sort_by?: "urgency" | "created_at" | "due_date";
}

export const listOrders = ({ page = 1, ...rest }: OrderListParams = {}) =>
  api.get<PaginatedResponse<WorkOrder>>("/api/v1/work_orders", { query: { page, page_size: 20, ...rest } });

export const getOrder = (id: number) => api.get<WorkOrder>(`/api/v1/work_orders/${id}`);

export type OrderTransition = "start" | "finish" | "reopen" | "cancel" | "charge" | "void_charge";

/** Cobro con uno o varios pagos (spec 015). */
export interface ChargeBody {
  payments: ChargePaymentInput[];
}

export const transitionOrder = (id: number, action: OrderTransition, body: Record<string, unknown> = {}) =>
  api.post<WorkOrder>(`/api/v1/work_orders/${id}/${action}`, { body });

/** La misma `Idempotency-Key` en un reintento no cobra dos veces. */
export const chargeOrder = (id: number, body: ChargeBody, idempotencyKey: string) =>
  api.post<WorkOrder>(`/api/v1/work_orders/${id}/charge`, { body, headers: { "Idempotency-Key": idempotencyKey } });

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

/** Productos del catálogo en una orden (spec 018): la API pone el precio y la descripción. */
export const addOrderItem = (orderId: number, body: { product_id: number; quantity: number }) =>
  api.post<WorkOrder>(`/api/v1/work_orders/${orderId}/items`, { body });

export const updateOrderItem = (orderId: number, itemId: number, body: { quantity: number }) =>
  api.patch<WorkOrder>(`/api/v1/work_orders/${orderId}/items/${itemId}`, { body });

export const deleteOrderItem = (orderId: number, itemId: number) =>
  api.delete<WorkOrder>(`/api/v1/work_orders/${orderId}/items/${itemId}`);

export const listEmployees = () =>
  api.get<PaginatedResponse<Employee>>("/api/v1/employees", { query: { page_size: 100, status: "active" } });

export const getMenu = () => api.get<{ menu: MenuGroup[] }>("/api/v1/products/menu");

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

export type CompanyAccess = "ok" | "expired" | "noModule";

/**
 * Pregunta a la API si la persona puede usar órdenes en esa empresa, sin cambiar la activa.
 * `summary` pasa por la suscripción y por el módulo, así que su 403 distingue los dos casos.
 */
export async function probeCompanyAccess(companyId: number): Promise<CompanyAccess> {
  try {
    await api.get("/api/v1/work_orders/summary", { headers: { "X-Company-Id": String(companyId) }, skipUnauthorized: true });
    return "ok";
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return error.code === "module_not_in_plan" ? "noModule" : "expired";
    return "ok";
  }
}
