import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const run = (work: () => Promise<void>) => {
  if (Platform.OS === "web") return;
  void work().catch(() => {});
};

/** Respuesta táctil breve; en web y en teléfonos sin motor háptico no hace nada. */
export const haptic = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
