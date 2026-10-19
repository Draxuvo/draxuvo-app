import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { t } from "@/i18n";
import { radius, space, useTheme } from "@/theme";
import { AppText, Button, Field, KeyboardFrame } from "./ui";

/** Hoja que pide el motivo antes de cancelar algo ya mandado (FR-030). */
export function CancelReasonSheet({
  visible,
  title,
  busy,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (!reason.trim()) {
      setError(t("reason.required"));
      return;
    }
    setError(null);
    onConfirm(reason.trim());
    setReason("");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardFrame>
        <Pressable accessibilityLabel={t("reason.cancel")} onPress={onClose} style={{ flex: 1, backgroundColor: c.scrim }} />
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space[5], gap: space[4] }}>
          <AppText variant="title" accessibilityRole="header">
            {title ?? t("reason.title")}
          </AppText>
          <Field label={t("reason.title")} value={reason} onChangeText={setReason} placeholder={t("reason.placeholder")} error={error} autoFocus multiline />
          <View style={{ flexDirection: "row", gap: space[3] }}>
            <Button label={t("reason.cancel")} variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button label={t("reason.confirm")} variant="danger" loading={busy} onPress={confirm} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardFrame>
    </Modal>
  );
}
