// Tipos que usa la app, copiados del contrato de la API (specs/011-app-movil-hibrida/contracts).
// La app no comparte código con draxuvo-ui: si la API cambia, se actualiza aquí.

export type CompanyRole = "staff" | "admin" | "owner";
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

/** Detalle del 403 `subscription_suspended` (spec 031): la empresa no pagó y no puede operar. `pay_url` solo llega a dueño y administrador. */
export interface SuspensionDetails {
  code: "subscription_suspended";
  reason: "plan_change" | "payment_overdue" | null;
  plan: string | null;
  cancels_at: string | null;
  pay_url?: string | null;
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
  | "add_note" | "add_photo" | "change_items";

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
  product?: { id: number; icon?: string | null; type_icon?: string | null } | null;
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
  | "voided" | "cancelled" | "reassigned" | "note" | "photo"
  | "item_added" | "item_updated" | "item_removed";

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
  created_by?: PersonRef | null;
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
  work_order_id?: number | null;
  work_order?: { id: number; title: string; customer_phone?: string } | null;
  /** Ticket de una cuenta de restaurante (sin orden de trabajo). */
  check?: { id: number; table: string | null; takeout_name: string | null; waiter: PersonName | null } | null;
  /** Pagos del cobro: de la cuenta o de la orden (spec 015). Los anulados traen `voided_at`. */
  payments?: TicketPayment[];
  items?: { description: string; quantity: number; unit_price: string | number; subtotal: string | number }[];
  status: TicketStatus;
  total: number;
  created_at: string;
  paid_at?: string;
  payment_method?: PaymentMethod | "mixed";
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
  /** Usuario ligado a la ficha, si tiene; une al empleado con el mesero de una cuenta. */
  user_id?: number | null;
  name: string;
  position?: string;
}

export interface MenuProduct {
  id: number;
  name: string;
  price: number;
  unit?: string;
  icon?: string | null;
  product_type?: { icon?: string | null } | null;
  /** Restaurante: agotado o con pocas existencias según lo comprometido en cuentas abiertas. */
  tracks_stock?: boolean;
  station_id?: number | null;
  available_qty?: number | null;
  sold_out?: boolean;
  low?: boolean;
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

// ── Restaurante (specs/013-restaurante-comandas/contracts/restaurant-api.md) ──

export interface PersonName {
  id: number;
  name: string;
}

export type ItemStatus = "draft" | "new" | "preparing" | "ready" | "delivered" | "cancelled";
export type CheckStatus = "open" | "closed" | "cancelled";

export interface CheckItem {
  id: number;
  name: string;
  product_id?: number | null;
  icon?: string | null;
  type_icon?: string | null;
  quantity: number;
  unit_price: string;
  note: string | null;
  status: ItemStatus;
  station: { id: number; name: string } | null;
  kitchen_order_number: number | null;
  sent_at: string | null;
  ready_at: string | null;
  allowed_actions: ("deliver" | "cancel")[];
}

export interface CheckPayment {
  id?: number;
  method: PaymentMethod;
  amount: string;
  reference: string | null;
  amount_received: string | null;
  change_given: string | null;
  terminal?: PaymentTerminalRef | null;
}

// Terminales de cobro del negocio (spec 015).
export type TerminalProvider =
  | "bbva" | "banorte" | "santander" | "banamex" | "getnet" | "mercado_pago" | "clip" | "other";

export interface PaymentTerminalRef {
  id: number;
  name: string;
  provider: TerminalProvider;
}

export interface PaymentTerminal extends PaymentTerminalRef {
  provider_label: string;
  active: boolean;
}

/** Un pago del cobro de una orden; el de una cuenta trae solo los campos de CheckPayment. */
export interface TicketPayment extends CheckPayment {
  method_label?: string;
  authorization_code?: string | null;
  card_last4?: string | null;
  source?: "manual";
  created_by?: PersonRef | null;
  created_at?: string;
  voided_at?: string | null;
}

/** Un pago en el cuerpo de POST /work_orders/:id/charge. */
export interface ChargePaymentInput {
  method: PaymentMethod;
  amount?: number;
  amount_received?: number;
  terminal_id?: number;
  authorization_code?: string;
  card_last4?: string;
  reference?: string;
}

export type CheckAction = "add_item" | "send" | "pay" | "reassign" | "cancel" | "close";

export interface Check {
  id: number;
  status: CheckStatus;
  table: { id: number; name: string } | null;
  takeout_name: string | null;
  waiter: PersonName | null;
  opened_at: string;
  total: string;
  paid: string;
  balance: string;
  items: CheckItem[];
  payments: CheckPayment[];
  ticket_id: number | null;
  allowed_actions: CheckAction[];
}

export interface ItemCounts {
  new: number;
  preparing: number;
  ready: number;
  delivered: number;
}

export interface CheckSummary {
  id: number;
  /** Mesero y total solo llegan de las cuentas propias o a quien es jefe (spec 032, FR-019b). */
  waiter?: PersonName | null;
  opened_at: string;
  total?: string;
  counts: ItemCounts;
  mine: boolean;
}

/** Estado de la mesa que calcula la API a partir de su cuenta abierta (spec 032). */
export type TableState = "free" | "occupied" | "to_pay";

export interface TableSummary {
  id: number;
  name: string;
  active: boolean;
  position: number;
  state?: TableState;
  check: CheckSummary | null;
}

export interface TakeoutSummary extends CheckSummary {
  takeout_name: string;
}

export interface ReadyItem {
  id: number;
  name: string;
  quantity: number;
  check_id: number;
  table: string | null;
  takeout_name: string | null;
  ready_at: string;
}

/** Cuenta cobrada hoy; mesero y total solo llegan de las cuentas propias o a quien es jefe. */
export interface ClosedCheckSummary {
  id: number;
  /** Nombre de la mesa; `null` en las cuentas para llevar. */
  name: string | null;
  takeout_name: string | null;
  closed_at: string;
  ticket_id: number | null;
  waiter?: PersonRef | null;
  total?: string;
  mine: boolean;
}

export interface TablesResponse {
  results: TableSummary[];
  takeouts: TakeoutSummary[];
  closed_today?: ClosedCheckSummary[];
  ready_items: ReadyItem[];
  stock_alerts?: number;
}

export interface RoundResponse {
  kitchen_order: { id: number; number: number; sent_at: string };
  sent: { id: number; name: string; quantity: number; station: { id: number; name: string } | null }[];
  rejected: { id: number; name: string; reason: string; available_qty: number | null }[];
  check: Check;
}

export interface PaymentResponse {
  payment: CheckPayment;
  check: { status: CheckStatus; total: string; paid: string; balance: string };
  ticket: Ticket | null;
}
