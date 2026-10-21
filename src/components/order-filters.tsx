import { ScrollView } from "react-native";
import type { Employee } from "@/api/types";
import { t } from "@/i18n";
import { space } from "@/theme";
import { Chip } from "./ui";

export interface OrderFilterValue {
  /** Ver las órdenes canceladas en lugar de una pestaña de estado (spec 023). */
  cancelled?: boolean;
  employeeId?: number;
}

/** Filtro por responsable, solo para encargados; Canceladas vive en la fila de pestañas de estado. */
export function OrderFilters({
  value,
  onChange,
  employees,
}: {
  value: OrderFilterValue;
  onChange: (next: OrderFilterValue) => void;
  employees?: Employee[];
}) {
  if (!employees || employees.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space[2], paddingHorizontal: space[4], paddingVertical: 3, alignItems: "center" }}>
      <Chip icon="users" label={t("orders.filters.all")} selected={!value.employeeId} onPress={() => onChange({ ...value, employeeId: undefined })} />
      {employees.map((employee) => (
        <Chip key={employee.id} label={employee.name} selected={value.employeeId === employee.id} onPress={() => onChange({ ...value, employeeId: employee.id })} />
      ))}
    </ScrollView>
  );
}
