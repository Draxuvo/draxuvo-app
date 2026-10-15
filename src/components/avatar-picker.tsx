import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import { removeAvatar, uploadAvatar } from "@/api/profile";
import type { User } from "@/api/types";
import { t } from "@/i18n";
import { ImageTooLargeError, NotAnImageError, PermissionDeniedError, pickImage, prepareImage } from "@/lib/image";
import { colors, spacing } from "@/theme";
import { describeError } from "./error-view";
import { AppText, Button } from "./ui";

const AVATAR_MAX_SIDE = 800;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function failureText(error: unknown): string {
  if (error instanceof PermissionDeniedError) return t(error.source === "camera" ? "orders.photo.permissionCamera" : "orders.photo.permissionLibrary");
  if (error instanceof NotAnImageError) return t("orders.photo.notImage");
  if (error instanceof ImageTooLargeError) return t("orders.photo.tooLarge");
  return describeError(error);
}

/** Foto de perfil con cámara o galería, o quitarla. Rechaza lo que no es imagen (FR-015, FR-018). */
export function AvatarPicker({ user, onChange }: { user: User; onChange: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<User | null>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await work();
      if (updated) onChange(updated);
    } catch (failure) {
      setError(failureText(failure));
    } finally {
      setBusy(false);
    }
  };

  const pick = (source: "camera" | "library") =>
    run(async () => {
      const asset = await pickImage(source);
      if (!asset) return null;
      return uploadAvatar(await prepareImage(asset, { maxSide: AVATAR_MAX_SIDE, maxBytes: AVATAR_MAX_BYTES }));
    });

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} accessibilityLabel={t("profileScreen.photo")} style={{ width: 72, height: 72, borderRadius: 36 }} />
        ) : (
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.anaquelBorde, alignItems: "center", justifyContent: "center" }}>
            <AppText variant="title">{user.first_name.slice(0, 1).toUpperCase()}</AppText>
          </View>
        )}
        <AppText variant="bodyStrong">{t("profileScreen.photo")}</AppText>
      </View>
      <View style={{ flexDirection: "row", gap: spacing[2] }}>
        <View style={{ flex: 1 }}>
          <Button label={t("profileScreen.camera")} variant="outline" loading={busy} onPress={() => void pick("camera")} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t("profileScreen.gallery")} variant="outline" loading={busy} onPress={() => void pick("library")} />
        </View>
      </View>
      {user.avatar_url ? <Button label={t("profileScreen.removePhoto")} variant="outline" disabled={busy} onPress={() => void run(() => removeAvatar())} /> : null}
      {error ? (
        <AppText style={{ color: colors.alerta }} accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
