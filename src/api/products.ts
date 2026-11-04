import { ApiError, api } from "./client";
import type { RemoteProduct } from "@/lib/scan";

/** Producto por código de barras o clave exacta (spec 056); `null` si la API responde que no existe. */
export async function productByCode(code: string): Promise<RemoteProduct | null> {
  try {
    return await api.get<RemoteProduct>("/api/v1/products/by_code", { query: { code } });
  } catch (failure) {
    if (failure instanceof ApiError && failure.status === 404) return null;
    throw failure;
  }
}
