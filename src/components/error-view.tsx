import { View } from "react-native";
import { ApiError, NetworkError } from "@/api/client";
import { t } from "@/i18n";
import { space } from "@/theme";
import { EmptyState } from "./empty-state";
import { ProblemArt } from "./illustrations";

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
    <View accessibilityRole="alert" style={{ paddingVertical: space[4] }}>
      <EmptyState art={<ProblemArt />} title={describeError(error)} actionLabel={onRetry ? t("common.retry") : undefined} onAction={onRetry} />
    </View>
  );
}
