import { useState } from "react";
import { View } from "react-native";
import { t } from "@/i18n";
import { space } from "@/theme";
import { AppText, Button, Field } from "../ui";

/** Motivo obligatorio para cancelar un producto ya mandado (FR-030), dentro de la hoja de la orden (spec 025). */
export function CancelReasonForm({ name, busy, onConfirm, onBack }: { name: string; busy?: boolean; onConfirm: (reason: string) => void; onBack: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (!reason.trim()) {
      setError(t("reason.required"));
      return;
    }
    setError(null);
    onConfirm(reason.trim());
  };

  return (
    <View style={{ gap: space[4] }}>
      <AppText tone="muted">{name}</AppText>
      <Field label={t("reason.title")} value={reason} onChangeText={setReason} placeholder={t("reason.placeholder")} error={error} autoFocus multiline />
      <View style={{ flexDirection: "row", gap: space[3] }}>
        <Button label={t("reason.cancel")} variant="outline" onPress={onBack} style={{ flex: 1 }} />
        <Button label={t("reason.confirm")} variant="danger" loading={busy} onPress={confirm} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
