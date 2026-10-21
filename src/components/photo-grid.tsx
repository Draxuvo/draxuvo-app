import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import type { WorkOrderPhoto } from "@/api/types";
import { useOutboxActions } from "@/hooks/use-outbox";
import { t } from "@/i18n";
import { toast } from "@/toast/store";
import { ImageTooLargeError, NotAnImageError, PermissionDeniedError, pickImage, prepareImage } from "@/lib/image";
import type { OutboxItem } from "@/outbox/db";
import { radius, rowEnter, space, useTheme } from "@/theme";
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
  const { c } = useTheme();
  const { addPhoto, retry, discard } = useOutboxActions();
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);

  const add = async (source: "camera" | "library") => {
    setBusy(true);
    try {
      const asset = await pickImage(source);
      if (!asset) return;
      await addPhoto(orderId, await prepareImage(asset));
    } catch (failure) {
      toast.error(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const size = width > 0 ? Math.floor((width - space[2] * 2) / 3) : 96;
  const tile = { width: size, height: size, borderRadius: radius.field, backgroundColor: c.surfaceAlt } as const;

  return (
    <View style={{ gap: space[3] }}>
      {photos.length === 0 && pending.length === 0 ? <AppText tone="muted">{t("orders.detail.photosEmpty")}</AppText> : null}
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {photos.map((photo, index) => (
          <Animated.View key={photo.id} entering={rowEnter(index)} style={tile}>
            <Image source={{ uri: photo.url }} accessibilityLabel={photo.description || t("orders.photo.alt")} style={{ flex: 1, borderRadius: radius.field }} contentFit="cover" transition={200} />
          </Animated.View>
        ))}
        {pending.map((item) => (
          <View key={item.id} style={{ width: size, gap: space[1] }} testID={`pending-photo-${item.id}`}>
            <Image source={{ uri: item.fileUri ?? undefined }} accessibilityLabel={t("orders.photo.alt")} style={[tile, { opacity: 0.55 }]} contentFit="cover" />
            <OutboxBadge item={item} onRetry={() => void retry(item.id)} onDiscard={() => void discard(item.id)} />
          </View>
        ))}
      </View>
      {canAdd ? (
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <View style={{ flex: 1 }}>
            <Button label={t("orders.photo.camera")} variant="tonal" icon="camera" loading={busy} onPress={() => void add("camera")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t("orders.photo.gallery")} variant="tonal" icon="image" loading={busy} onPress={() => void add("library")} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
