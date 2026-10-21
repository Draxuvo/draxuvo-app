import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { checkIn, checkOut, getMyAttendance, type MyAttendance } from "@/api/attendance";
import { useAppActive } from "@/hooks/use-restaurant";
import { useSession } from "@/session";

/** Estado de hoy y marcas de entrada y salida de quien tiene la sesión (spec 026). */
export function useAttendance() {
  const qc = useQueryClient();
  const { user, companyId } = useSession();
  const active = useAppActive();
  const key = ["company", companyId, "attendance", "today"] as const;

  const query = useQuery({ queryKey: key, queryFn: getMyAttendance, enabled: !!user && companyId != null, retry: false });

  // Al volver a la app el estado se vuelve a pedir: pudo marcarse desde el panel.
  const { refetch } = query;
  useEffect(() => {
    if (active && user && companyId != null) void refetch();
  }, [active, user, companyId, refetch]);

  const onSuccess = (data: MyAttendance) => qc.setQueryData(key, data);
  const markIn = useMutation({ mutationFn: checkIn, onSuccess });
  const markOut = useMutation({ mutationFn: checkOut, onSuccess });

  // Con error (sin red, módulo fuera del plan) no se afirma ningún estado.
  const data = query.isError ? undefined : query.data;
  return { data, eligible: !!data?.eligible, state: data?.state, markIn, markOut };
}
