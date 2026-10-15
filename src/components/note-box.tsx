import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import type { WorkOrderEvent } from "@/api/types";
import { useOutboxActions } from "@/hooks/use-outbox";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import type { OutboxItem } from "@/outbox/db";
import { fadeIn, radius, space, useTheme } from "@/theme";
import { Monogram } from "./order-card";
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
  const { c } = useTheme();
  const { addNote, retry, discard } = useOutboxActions();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const notes = events.filter((event) => event.kind === "note");

  const submit = async () => {
    if (!text.trim()) {
      haptic.warning();
      return setError(t("orders.note.emptyText"));
    }
    setError(null);
    await addNote(orderId, text);
    setText("");
  };

  const bubble = { backgroundColor: c.surfaceAlt, borderRadius: radius.field, padding: space[3], gap: 2 } as const;

  return (
    <View style={{ gap: space[3] }}>
      {notes.length === 0 && pending.length === 0 ? <AppText tone="muted">{t("orders.detail.notesEmpty")}</AppText> : null}
      {notes.map((note) => (
        <View key={note.id} style={{ flexDirection: "row", gap: space[2], alignItems: "flex-start" }}>
          <Monogram name={note.actor?.name ?? "?"} />
          <View style={[bubble, { flex: 1 }]}>
            <AppText variant="label" tone="muted" style={{ letterSpacing: 0.2 }}>
              {note.actor?.name ?? ""}
            </AppText>
            <AppText>{String(note.data.text ?? "")}</AppText>
          </View>
        </View>
      ))}
      {pending.map((item) => (
        <Animated.View entering={fadeIn} key={item.id} style={{ gap: space[2] }} testID={`pending-note-${item.id}`}>
          <View style={[bubble, { backgroundColor: c.primarySoft }]}>
            <AppText>{item.text}</AppText>
          </View>
          <OutboxBadge item={item} onRetry={() => void retry(item.id)} onDiscard={() => void discard(item.id)} />
        </Animated.View>
      ))}
      {canAdd ? (
        <View style={{ gap: space[2] }}>
          <Field
            label={t("orders.note.placeholder")}
            value={text}
            onChangeText={setText}
            error={error}
            multiline
            style={{ minHeight: 72, textAlignVertical: "top" }}
            testID="note-input"
          />
          <Button label={t("orders.note.add")} variant="tonal" icon="send" onPress={() => void submit()} />
        </View>
      ) : null}
    </View>
  );
}
