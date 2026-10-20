import { View } from "react-native";
import type { PaymentTerminal } from "@/api/types";
import { t } from "@/i18n";
import { space } from "@/theme";
import { AppText, Chip } from "./ui";

/**
 * Elige en qué terminal del negocio se pasó la tarjeta (spec 015, FR-020). Sin terminales no se dibuja;
 * con una sola, la pantalla ya la trae elegida.
 */
export function TerminalPicker({
  terminals,
  value,
  onChange,
  error,
}: {
  terminals: PaymentTerminal[];
  value: number | null;
  onChange: (id: number) => void;
  error?: string | null;
}) {
  if (terminals.length === 0) return null;
  return (
    <View style={{ gap: space[2] }}>
      <AppText variant="label" tone="muted">
        {t("terminals.label").toUpperCase()}
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {terminals.map((terminal) => (
          <Chip key={terminal.id} icon="credit-card" label={terminal.name} selected={value === terminal.id} onPress={() => onChange(terminal.id)} />
        ))}
      </View>
      {error ? (
        <AppText tone="stamp" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
