import { api } from "./client";
import type { PaginatedResponse, Subscription, Ticket, TicketStatus } from "./types";

export interface TicketListParams {
  page?: number;
  status?: TicketStatus;
  search?: string;
}

export const listTickets = ({ page = 1, ...rest }: TicketListParams = {}) =>
  api.get<PaginatedResponse<Ticket>>("/api/v1/tickets", { query: { page, page_size: 20, ...rest } });

export const getTicket = (id: number) => api.get<Ticket>(`/api/v1/tickets/${id}`);

export const sendTicketWhatsapp = (id: number, phone?: string) =>
  api.post<{ message: string }>(`/api/v1/tickets/${id}/send_whatsapp`, { body: phone ? { phone } : {} });

/** Staff recibe 403 aquí; quien llama lo trata como "sin WhatsApp". */
export const getSubscription = () => api.get<Subscription>("/api/v1/subscription");
