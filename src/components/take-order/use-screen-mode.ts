import { useTables } from "@/hooks/use-restaurant";
import { useSession } from "@/session";
import { screenMode, type ScreenMode } from "./lib";

/**
 * Modo de la pantalla según la empresa activa (spec 018, R2). Staff no puede leer la suscripción: el plano de
 * mesas decide si hay restaurante. Un restaurante sin ninguna mesa dada de alta no cuenta, porque los planes
 * Pro y Empresa traen el módulo aunque el negocio no sea un restaurante.
 */
export function useScreenMode(): ScreenMode {
  const { user, companyId } = useSession();
  const tables = useTables();
  const orderMode = user?.companies.find((company) => company.id === companyId)?.order_mode;
  const hasTables = !!tables.data?.results.some((table) => table.active);
  return screenMode(hasTables ? ["restaurant"] : [], orderMode);
}
