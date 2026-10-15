import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { View } from "react-native";
import { ApiError, apiUrl, authHeaders } from "@/api/client";
import { sendTicketWhatsapp } from "@/api/tickets";
import type { Ticket } from "@/api/types";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { space } from "@/theme";
import { describeError } from "./error-view";
import { AppText, Button } from "./ui";

/** Descarga el PDF con la sesión y abre el menú de compartir del teléfono (guardar, apps, correo). */
export async function shareTicketPdf(ticket: Ticket): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error("share_unavailable");
  const destination = new File(Paths.cache, `ticket-${ticket.folio}.pdf`);
  if (destination.exists) destination.delete();
  const file = await File.downloadFileAsync(`${apiUrl()}/api/v1/tickets/${ticket.id}/download`, destination, { headers: authHeaders() });
  await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: ticket.folio });
}

export function TicketActions({ ticket, canWhatsapp }: { ticket: Ticket; canWhatsapp: boolean }) {
  const [busy, setBusy] = useState<"pdf" | "whatsapp" | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const share = async () => {
    setBusy("pdf");
    setMessage(null);
    try {
      await shareTicketPdf(ticket);
    } catch (error) {
      haptic.warning();
      const text = error instanceof Error && error.message === "share_unavailable" ? t("ticket.shareUnavailable") : t("ticket.downloadFailed");
      setMessage({ text, error: true });
    } finally {
      setBusy(null);
    }
  };

  const whatsapp = async () => {
    setBusy("whatsapp");
    setMessage(null);
    try {
      await sendTicketWhatsapp(ticket.id);
      haptic.success();
      setMessage({ text: t("ticket.whatsappSent"), error: false });
    } catch (error) {
      haptic.warning();
      const phoneMissing = error instanceof ApiError && error.status === 400;
      setMessage({ text: phoneMissing ? t("ticket.whatsappPhone") : describeError(error), error: true });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: space[2] }}>
      <Button label={t("ticket.share")} icon="share-2" onPress={() => void share()} loading={busy === "pdf"} disabled={busy !== null} />
      {canWhatsapp ? (
        <Button label={t("ticket.whatsapp")} variant="tonal" icon="message-circle" onPress={() => void whatsapp()} loading={busy === "whatsapp"} disabled={busy !== null} />
      ) : null}
      {message ? (
        <AppText tone={message.error ? "stamp" : "ok"} accessibilityLiveRegion="polite" testID="ticket-message">
          {message.text}
        </AppText>
      ) : null}
    </View>
  );
}
