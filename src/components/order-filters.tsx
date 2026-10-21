import { ScrollView, View } from "react-native";
import type { Employee } from "@/api/types";
import { t } from "@/i18n";
import { space } from "@/theme";
import { Chip } from "./ui";

export interface OrderFilterValue {
  /** Ver las órdenes canceladas en lugar de una pestaña de estado (spec 023). */
  cancelled?: boolean;
  employeeId?: number;
}

/** Filtros de la lista: Canceladas (aparte de las pestañas) y responsable, este último solo para encargados. */
export function OrderFilters({
  value,
  onChange,
  employees,
}: {
  value: OrderFilterValue;
  onChange: (next: OrderFilterValue) => void;
  employees?: Employee[];
}) {
  const row = { gap: space[2], paddingHorizontal: space[4] } as const;
  return (
    <View style={{ gap: space[2] }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={row}>
        <Chip icon="x-circle" label={t("orders.cancelledFilter")} selected={!!value.cancelled} onPress={() => onChange({ ...value, cancelled: !value.cancelled })} />
        {employees && employees.length > 0 ? (
          <>
            <Chip icon="users" label={t("orders.filters.all")} selected={!value.employeeId} onPress={() => onChange({ ...value, employeeId: undefined })} />
            {employees.map((employee) => (
              <Chip key={employee.id} label={employee.name} selected={value.employeeId === employee.id} onPress={() => onChange({ ...value, employeeId: employee.id })} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
