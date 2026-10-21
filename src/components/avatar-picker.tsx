import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import { removeAvatar, uploadAvatar } from "@/api/profile";
import type { User } from "@/api/types";
import { t } from "@/i18n";
import { toast } from "@/toast/store";
import { ImageTooLargeError, NotAnImageError, PermissionDeniedError, pickImage, prepareImage } from "@/lib/image";
import { space, useTheme } from "@/theme";
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
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<User | null>) => {
    setBusy(true);
    try {
      const updated = await work();
      if (updated) onChange(updated);
    } catch (failure) {
      toast.error(failureText(failure));
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
    <View style={{ gap: space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} accessibilityLabel={t("profileScreen.photo")} style={{ width: 88, height: 88, borderRadius: 44 }} contentFit="cover" transition={200} />
        ) : (
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <AppText variant="display" style={{ color: c.onPrimarySoft }}>
              {user.first_name.slice(0, 1).toUpperCase()}
            </AppText>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <AppText variant="title">{[user.first_name, user.last_name].filter(Boolean).join(" ")}</AppText>
          <AppText tone="muted">{user.email}</AppText>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Button label={t("profileScreen.camera")} variant="tonal" icon="camera" loading={busy} onPress={() => void pick("camera")} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t("profileScreen.gallery")} variant="tonal" icon="image" loading={busy} onPress={() => void pick("library")} />
        </View>
      </View>
      {user.avatar_url ? <Button label={t("profileScreen.removePhoto")} variant="text" disabled={busy} onPress={() => void run(() => removeAvatar())} /> : null}
    </View>
  );
}
