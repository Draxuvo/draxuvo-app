import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import { listTickets } from "@/api/tickets";
import { useKeys } from "@/hooks/use-orders";

/**
 * ¿El plan de la empresa incluye el módulo de tickets? (spec 051) El staff no puede leer la suscripción: se averigua
 * con una consulta mínima a la lista, que responde 403 `module_not_in_plan` si no lo incluye. Mientras no hay
 * respuesta el historial no se ofrece, para no mostrar una opción que luego desaparece.
 */
export function useTicketsAvailable(): { available: boolean; ready: boolean } {
  const keys = useKeys();
  const probe = useQuery({
    queryKey: keys.tickets({ probe: true }),
    queryFn: () => listTickets({ page: 1 }),
    retry: false,
    staleTime: 60_000,
  });
  const locked = probe.error instanceof ApiError && probe.error.status === 403 && probe.error.code === "module_not_in_plan";
  const ready = probe.isSuccess || probe.isError;
  return { available: ready && !locked, ready };
}
