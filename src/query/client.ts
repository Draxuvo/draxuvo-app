import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/client";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // Un 4xx no mejora al repetirlo; solo se reintenta lo que pudo ser un fallo de red.
        retry: (count, error) => !(error instanceof ApiError) && count < 2,
      },
    },
  });
}
