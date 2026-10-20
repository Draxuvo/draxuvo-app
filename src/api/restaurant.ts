import { api } from "./client";
import type {
  Check,
  MenuGroup,
  PaymentMethod,
  PaymentResponse,
  RoundResponse,
  TablesResponse,
} from "./types";

const base = "/api/v1/restaurant";

export const listTables = () => api.get<TablesResponse>(`${base}/tables`);

export const openCheck = (body: { dining_table_id: number } | { takeout_name: string }) =>
  api.post<Check>(`${base}/checks`, { body });

export const listWaiters = () => api.get<{ results: { id: number; name: string }[] }>(`${base}/checks/waiters`);

export const getCheck = (id: number) => api.get<Check>(`${base}/checks/${id}`);

export const reassignCheck = (id: number, waiterId: number) =>
  api.patch<Check>(`${base}/checks/${id}`, { body: { waiter_id: waiterId } });

export const cancelCheck = (id: number, reason?: string) =>
  api.post<Check>(`${base}/checks/${id}/cancel`, { body: { reason } });

export const addItem = (checkId: number, body: { product_id: number; quantity: number; note?: string }) =>
  api.post<Check>(`${base}/checks/${checkId}/items`, { body });

export const updateItem = (checkId: number, itemId: number, body: { quantity?: number; note?: string }) =>
  api.patch<Check>(`${base}/checks/${checkId}/items/${itemId}`, { body });

export const removeItem = (checkId: number, itemId: number) =>
  api.delete<Check>(`${base}/checks/${checkId}/items/${itemId}`);

/** La llave se genera una vez por intento y se conserva hasta el 2xx: reenviar nunca duplica la comanda. */
export const sendRound = (checkId: number, idempotencyKey: string) =>
  api.post<RoundResponse>(`${base}/checks/${checkId}/rounds`, { headers: { "Idempotency-Key": idempotencyKey } });

export const deliverItem = (checkId: number, itemId: number) =>
  api.post<Check>(`${base}/checks/${checkId}/items/${itemId}/deliver`);

export const cancelItem = (checkId: number, itemId: number, reason: string) =>
  api.post<Check>(`${base}/checks/${checkId}/items/${itemId}/cancel`, { body: { reason } });

export interface PaymentBody {
  method: PaymentMethod;
  amount: string;
  reference?: string;
  amount_received?: string;
  confirm_incomplete?: boolean;
  /** Terminal del negocio en que se cobró con tarjeta (spec 015). */
  terminal_id?: number;
}

export const addPayment = (checkId: number, body: PaymentBody, idempotencyKey: string) =>
  api.post<PaymentResponse>(`${base}/checks/${checkId}/payments`, {
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const getRestaurantMenu = () => api.get<{ menu: MenuGroup[] }>("/api/v1/products/menu");
