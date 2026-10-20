import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/session";
import { api } from "./client";
import type { PaymentTerminal } from "./types";

/** Terminales activas de la empresa para elegir en qué terminal se cobró con tarjeta (spec 015). */
export const listTerminals = () => api.get<{ results: PaymentTerminal[] }>("/api/v1/payment_terminals");

export function useTerminals({ enabled = true }: { enabled?: boolean } = {}) {
  const { companyId } = useSession();
  return useQuery({
    queryKey: ["company", companyId, "payment-terminals"],
    queryFn: async () => (await listTerminals()).results,
    enabled,
  });
}
