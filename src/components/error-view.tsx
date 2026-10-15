import { View } from "react-native";
import { ApiError, NetworkError } from "@/api/client";
import { t } from "@/i18n";
import { colors, spacing } from "@/theme";
import { AppText, Button } from "./ui";

/** Mensaje claro para el error de una petición (FR-016). */
export function describeError(error: unknown): string {
  if (error instanceof NetworkError) return t("errors.network");
  if (error instanceof ApiError) {
    if (error.code === "module_not_in_plan") return t("errors.moduleNotInPlan");
    if (error.status === 401) return t("errors.sessionExpired");
    if (error.status === 403) return typeof error.details === "string" ? error.details : t("errors.forbidden");
    if (error.status === 404) return t("errors.notFound");
    if (error.status === 422 || error.status === 400) {
      const detail = Array.isArray(error.details) ? (error.details as string[]).join(" ") : error.details;
      return typeof detail === "string" && detail ? detail : error.message;
    }
  }
  return t("errors.generic");
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={{ padding: spacing[6], gap: spacing[4], alignItems: "stretch" }} accessibilityRole="alert">
      <AppText variant="title" style={{ color: colors.alerta }}>
        {describeError(error)}
      </AppText>
      {onRetry ? <Button label={t("common.retry")} variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}
