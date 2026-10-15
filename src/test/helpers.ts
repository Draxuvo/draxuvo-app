import * as SecureStore from "expo-secure-store";
import type { User } from "@/api/types";

export const staffUser: User = {
  id: 1,
  email: "staff@volta.demo",
  first_name: "Sara",
  last_name: "Staff",
  role: "staff",
  active: true,
  companies: [{ id: 10, name: "Volta", slug: "volta", role: "staff", parent_company_id: null, order_mode: "service" }],
};

export const multiUser: User = {
  ...staffUser,
  id: 2,
  email: "multi@demo.demo",
  role: "owner",
  companies: [
    { id: 10, name: "Volta", slug: "volta", role: "owner", parent_company_id: null, order_mode: "service" },
    { id: 20, name: "Sazón", slug: "sazon", role: "staff", parent_company_id: null, order_mode: "order" },
  ],
};

/** Respuesta de `fetch` con la forma que usa el cliente. */
export function reply(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 400, status, text: () => Promise.resolve(JSON.stringify(body)) });
}

export function apiError(status: number, details: unknown = null, message = "error") {
  return reply(status, { error: { status, message, details } });
}

export function mockFetch() {
  const fn = jest.fn();
  Object.defineProperty(global, "fetch", { value: fn, writable: true, configurable: true });
  return fn;
}

export async function seedSession(user: User, companyId: number, biometricEnabled = false) {
  await SecureStore.setItemAsync("draxuvo.session", JSON.stringify({ token: "tok", user, companyId, biometricEnabled }));
}

export async function clearStore() {
  await SecureStore.deleteItemAsync("draxuvo.session");
}
