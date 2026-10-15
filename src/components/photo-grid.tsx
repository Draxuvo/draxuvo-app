import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import type { WorkOrderPhoto } from "@/api/types";
import { useOutboxActions } from "@/hooks/use-outbox";
import { t } from "@/i18n";
import { ImageTooLargeError, NotAnImageError, PermissionDeniedError, pickImage, prepareImage } from "@/lib/image";
import type { OutboxItem } from "@/outbox/db";
import { colors, radii, spacing } from "@/theme";
import { OutboxBadge } from "./outbox-badge";
import { AppText, Button } from "./ui";

function errorText(error: unknown): string {
  if (error instanceof PermissionDeniedError) return t(error.source === "camera" ? "orders.photo.permissionCamera" : "orders.photo.permissionLibrary");
  if (error instanceof NotAnImageError) return t("orders.photo.notImage");
  if (error instanceof ImageTooLargeError) return t("orders.photo.tooLarge");
  return t("errors.generic");
}

/** Fotos de la orden con cámara y galería. Lo recién tomado pasa por la cola y se ve como pendiente (FR-010, FR-023). */
export function PhotoGrid({
  orderId,
  canAdd,
  photos,
  pending,
}: {
  orderId: number;
  canAdd: boolean;
  photos: WorkOrderPhoto[];
  pending: OutboxItem[];
}) {
  const { addPhoto, retry, discard } = useOutboxActions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (source: "camera" | "library") => {
    setError(null);
    setBusy(true);
    try {
      const asset = await pickImage(source);
      if (!asset) return;
      await addPhoto(orderId, await prepareImage(asset));
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: spacing[3] }}>
      {photos.length === 0 && pending.length === 0 ? <AppText muted>{t("orders.detail.photosEmpty")}</AppText> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        {photos.map((photo) => (
          <Image
            key={photo.id}
            source={{ uri: photo.url }}
            accessibilityLabel={photo.description || t("orders.photo.alt")}
            style={{ width: 104, height: 104, borderRadius: radii.etiqueta, backgroundColor: colors.anaquel }}
            contentFit="cover"
          />
        ))}
        {pending.map((item) => (
          <View key={item.id} style={{ width: 104, gap: spacing[1] }} testID={`pending-photo-${item.id}`}>
            <Image
              source={{ uri: item.fileUri ?? undefined }}
              accessibilityLabel={t("orders.photo.alt")}
              style={{ width: 104, height: 104, borderRadius: radii.etiqueta, opacity: 0.6, backgroundColor: colors.anaquel }}
              contentFit="cover"
            />
            <OutboxBadge item={item} onRetry={() => void retry(item.id)} onDiscard={() => void discard(item.id)} />
          </View>
        ))}
      </View>
      {error ? (
        <AppText style={{ color: colors.alerta }} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      {canAdd ? (
        <View style={{ flexDirection: "row", gap: spacing[2] }}>
          <View style={{ flex: 1 }}>
            <Button label={t("orders.photo.camera")} variant="outline" loading={busy} onPress={() => void add("camera")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t("orders.photo.gallery")} variant="outline" loading={busy} onPress={() => void add("library")} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
