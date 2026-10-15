import Constants from "expo-constants";
import { Platform } from "react-native";

/** Error devuelto por la API con la forma `{ error: { status, message, details } }`. */
export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** Código de `details.code` cuando la API lo manda (por ejemplo `module_not_in_plan`). */
  get code(): string | null {
    const details = this.details as { code?: unknown } | null;
    return typeof details?.code === "string" ? details.code : null;
  }
}

/** La petición no llegó al servidor (sin red, tiempo agotado). */
export class NetworkError extends Error {
  constructor() {
    super("network");
    this.name = "NetworkError";
  }
}

interface ClientHooks {
  getToken: () => string | null;
  getCompanyId: () => number | null;
  getLocale: () => string;
  onUnauthorized: () => void;
}

let hooks: ClientHooks = {
  getToken: () => null,
  getCompanyId: () => null,
  getLocale: () => "es",
  onUnauthorized: () => {},
};

/** La sesión y el idioma se conectan aquí al arrancar; el cliente no los importa. */
export function configureClient(next: Partial<ClientHooks>) {
  hooks = { ...hooks, ...next };
}

export function apiUrl(): string {
  return (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function appVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

/** Cabeceras de toda petición autenticada (contrato: Authorization, X-Company-Id, locale, X-App-Version). */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    locale: hooks.getLocale(),
    "X-App-Version": `${appVersion()} ${Platform.OS}`,
  };
  const token = hooks.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const companyId = hooks.getCompanyId();
  if (companyId != null) headers["X-Company-Id"] = String(companyId);
  return headers;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  /** No cierra la sesión ante un 401 (por ejemplo, en el login). */
  skipUnauthorized?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query): string {
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${apiUrl()}${path}${params.length ? `?${params.join("&")}` : ""}`;
}

function parseError(status: number, payload: unknown): ApiError {
  const error = (payload as { error?: { message?: string; details?: unknown } } | null)?.error;
  return new ApiError(status, error?.message ?? `HTTP ${status}`, error?.details ?? null);
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...authHeaders(), ...options.headers };
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), { method, headers, body, signal: options.signal });
  } catch {
    throw new NetworkError();
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !options.skipUnauthorized) hooks.onUnauthorized();
    throw parseError(response.status, payload);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>("POST", path, options),
  patch: <T>(path: string, options?: RequestOptions) => request<T>("PATCH", path, options),
  put: <T>(path: string, options?: RequestOptions) => request<T>("PUT", path, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
};
