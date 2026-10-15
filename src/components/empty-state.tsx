import type { ReactNode } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { riseIn, space } from "@/theme";
import { AppText, Button } from "./ui";

/** Pantalla vacía con ilustración, un mensaje y, si sirve, la acción siguiente. */
export function EmptyState({
  art,
  title,
  body,
  actionLabel,
  onAction,
  testID,
}: {
  art: ReactNode;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <Animated.View entering={riseIn} style={{ alignItems: "center", gap: space[3], padding: space[8] }} testID={testID}>
      {art}
      <AppText variant="title" style={{ textAlign: "center" }} accessibilityRole="header">
        {title}
      </AppText>
      {body ? (
        <AppText tone="muted" style={{ textAlign: "center", maxWidth: 300 }}>
          {body}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ alignSelf: "stretch", marginTop: space[2] }}>
          <Button label={actionLabel} variant="tonal" onPress={onAction} />
        </View>
      ) : null}
    </Animated.View>
  );
}
