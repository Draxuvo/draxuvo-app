import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { Employee, WorkOrderStatus } from "@/api/types";
import { t } from "@/i18n";
import { colors, MIN_TOUCH, radii, spacing } from "@/theme";
import { AppText } from "./ui";

export const FILTER_STATUSES: WorkOrderStatus[] = ["open", "in_progress", "done", "paid", "cancelled"];

export interface OrderFilterValue {
  status?: WorkOrderStatus;
  employeeId?: number;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <AppText variant="bodyStrong" style={{ color: selected ? colors.etiqueta : colors.tinta }}>
        {label}
      </AppText>
    </Pressable>
  );
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
  return (
    <View style={{ gap: spacing[2] }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip label={t("orders.filters.all")} selected={!value.status} onPress={() => onChange({ ...value, status: undefined })} />
        {FILTER_STATUSES.map((status) => (
          <Chip
            key={status}
            label={t(`orders.status.${status}`)}
            selected={value.status === status}
            onPress={() => onChange({ ...value, status })}
          />
        ))}
      </ScrollView>
      {employees && employees.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          <Chip label={t("orders.filters.all")} selected={!value.employeeId} onPress={() => onChange({ ...value, employeeId: undefined })} />
          {employees.map((employee) => (
            <Chip
              key={employee.id}
              label={employee.name}
              selected={value.employeeId === employee.id}
              onPress={() => onChange({ ...value, employeeId: employee.id })}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing[2], paddingHorizontal: spacing[4] },
  chip: {
    minHeight: MIN_TOUCH,
    justifyContent: "center",
    paddingHorizontal: spacing[4],
    borderRadius: radii.pastilla,
    borderWidth: 1.5,
    borderColor: colors.anaquelBorde,
    backgroundColor: colors.etiqueta,
  },
  chipOn: { backgroundColor: colors.tinta, borderColor: colors.tinta },
});
