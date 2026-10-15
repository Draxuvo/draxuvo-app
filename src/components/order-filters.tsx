import { ScrollView, View } from "react-native";
import type { Employee, WorkOrderStatus } from "@/api/types";
import { t } from "@/i18n";
import { space } from "@/theme";
import { Chip } from "./ui";

export const FILTER_STATUSES: WorkOrderStatus[] = ["open", "in_progress", "done", "paid", "cancelled"];

export interface OrderFilterValue {
  status?: WorkOrderStatus;
  employeeId?: number;
}

/** Filtros por estado y responsable (FR-024); la lista de responsables solo se pasa a encargados. */
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
        <Chip label={t("orders.filters.all")} selected={!value.status} onPress={() => onChange({ ...value, status: undefined })} />
        {FILTER_STATUSES.map((status) => (
          <Chip key={status} label={t(`orders.status.${status}`)} selected={value.status === status} onPress={() => onChange({ ...value, status })} />
        ))}
      </ScrollView>
      {employees && employees.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={row}>
          <Chip icon="users" label={t("orders.filters.all")} selected={!value.employeeId} onPress={() => onChange({ ...value, employeeId: undefined })} />
          {employees.map((employee) => (
            <Chip key={employee.id} label={employee.name} selected={value.employeeId === employee.id} onPress={() => onChange({ ...value, employeeId: employee.id })} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
