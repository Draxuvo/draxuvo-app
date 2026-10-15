// Tipos que usa la app, copiados del contrato de la API (specs/011-app-movil-hibrida/contracts).
// La app no comparte código con draxuvo-ui: si la API cambia, se actualiza aquí.

export type CompanyRole = "staff" | "manager" | "admin" | "owner";
export type Role = CompanyRole | "super_admin";
export type OrderMode = "service" | "order";

export interface UserCompany {
  id: number;
  name: string;
  slug: string;
  role: CompanyRole;
  parent_company_id: number | null;
  order_mode: OrderMode;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  role: Role;
  active: boolean;
  companies: UserCompany[];
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type WorkOrderStatus = "open" | "in_progress" | "done" | "paid" | "cancelled";
export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
export type PaymentMethod = "cash" | "card" | "transfer";
export type WorkOrderAction =
  | "start" | "finish" | "reopen" | "charge" | "void_charge" | "cancel"
  | "edit" | "delete" | "add_item" | "edit_items" | "edit_steps" | "check_steps"
  | "add_note" | "add_photo";

export interface PersonRef {
  id: number;
  name: string;
}

export interface WorkOrderItem {
  id: number;
  description: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
  subtotal?: number;
  position: number;
  product_id?: number;
}

export interface WorkOrderStep {
  id: number;
  description: string;
  position: number;
  done: boolean;
  done_at?: string;
  done_by?: PersonRef;
}

export interface WorkOrderPhoto {
  id: number;
  url: string;
  description?: string;
  uploaded_by: PersonRef;
  created_at: string;
}

export type WorkOrderEventKind =
  | "created" | "started" | "finished" | "reopened" | "charged"
  | "voided" | "cancelled" | "reassigned" | "note" | "photo";

export interface WorkOrderEvent {
  id: number;
  kind: WorkOrderEventKind;
  actor: PersonRef | null;
  data: Record<string, unknown>;
  created_at: string;
}

export interface WorkOrder {
  id: number;
  title: string;
  description?: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  due_date?: string;
  completed_at?: string;
  notes?: string;
  progress: number;
  total?: number;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  employee?: PersonRef | null;
  items_count: number;
  steps_count: number;
  steps_done: number;
  created_at: string;
  // Solo en el detalle
  items?: WorkOrderItem[];
  steps?: WorkOrderStep[];
  photos?: WorkOrderPhoto[];
  events?: WorkOrderEvent[];
  ticket?: Ticket | null;
  allowed_actions?: WorkOrderAction[];
  charge_blocked_reason?: "no_items" | null;
  cancel_reason?: string | null;
}

export type TicketStatus = "pending" | "paid" | "voided";

export interface Ticket {
  id: number;
  folio: string;
  work_order_id: number;
  work_order?: { id: number; title: string; customer_phone?: string };
  status: TicketStatus;
  total: number;
  created_at: string;
  paid_at?: string;
  payment_method?: PaymentMethod;
  payment_method_label?: string;
  amount_received?: number;
  change_given?: number;
}

export interface PageInfo {
  page_size: number;
  page_index: number;
  total: number;
  page_start: number;
  page_end: number;
}

export interface PaginatedResponse<T> {
  info: PageInfo;
  results: T[];
}

export interface Employee {
  id: number;
  name: string;
  position?: string;
}

export interface MenuProduct {
  id: number;
  name: string;
  price: number;
  unit?: string;
}

export interface MenuGroup {
  category: string;
  items: MenuProduct[];
}

export interface Subscription {
  status: string;
  active_access: boolean;
  active_modules: string[];
}

export interface AppConfig {
  min_app_version: { ios: string; android: string };
}
