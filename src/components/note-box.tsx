import { useState } from "react";
import { View } from "react-native";
import type { WorkOrderEvent } from "@/api/types";
import { useOutboxActions } from "@/hooks/use-outbox";
import { t } from "@/i18n";
import type { OutboxItem } from "@/outbox/db";
import { colors, spacing } from "@/theme";
import { OutboxBadge } from "./outbox-badge";
import { AppText, Button, Field } from "./ui";

/** Notas de la orden. Escribir una la guarda en la cola: se ve como pendiente hasta que llega a la API (FR-009, FR-023). */
export function NoteBox({
  orderId,
  canAdd,
  events,
  pending,
}: {
  orderId: number;
  canAdd: boolean;
  events: WorkOrderEvent[];
  pending: OutboxItem[];
}) {
  const { addNote, retry, discard } = useOutboxActions();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const notes = events.filter((event) => event.kind === "note");

  const submit = async () => {
    if (!text.trim()) return setError(t("orders.note.emptyText"));
    setError(null);
    await addNote(orderId, text);
    setText("");
  };

  return (
    <View style={{ gap: spacing[3] }}>
      {notes.length === 0 && pending.length === 0 ? <AppText muted>{t("orders.detail.notesEmpty")}</AppText> : null}
      {notes.map((note) => (
        <View key={note.id} style={{ gap: 2 }}>
          <AppText>{String(note.data.text ?? "")}</AppText>
          <AppText variant="label" muted>
            {note.actor?.name ?? ""}
          </AppText>
        </View>
      ))}
      {pending.map((item) => (
        <View key={item.id} style={{ gap: 2, opacity: 0.8 }} testID={`pending-note-${item.id}`}>
          <AppText>{item.text}</AppText>
          <OutboxBadge item={item} onRetry={() => void retry(item.id)} onDiscard={() => void discard(item.id)} />
        </View>
      ))}
      {canAdd ? (
        <View style={{ gap: spacing[2] }}>
          <Field
            label={t("orders.note.placeholder")}
            value={text}
            onChangeText={setText}
            error={error}
            multiline
            style={{ minHeight: 80, textAlignVertical: "top", paddingTop: spacing[3], borderColor: colors.anaquelBorde }}
            testID="note-input"
          />
          <Button label={t("orders.note.add")} onPress={() => void submit()} />
        </View>
      ) : null}
    </View>
  );
}
