import { useRouter, useSegments } from "expo-router";
import { useEffect, useState, type PropsWithChildren } from "react";
import { ActivityIndicator, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "@/components/brand";
import { AppText, Button } from "@/components/ui";
import { t, useLocale } from "@/i18n";
import { useSession } from "@/session";
import { fadeIn, space, useTheme } from "@/theme";
import { mustUpdate } from "./version";

function Splash() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.background, alignItems: "center", justifyContent: "center", gap: space[6] }}>
      <BrandMark size={72} />
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

/**
 * Decide qué se ve al abrir: versión no compatible, entrada, bloqueo biométrico o la app.
 * Las pantallas no repiten esta lógica (spec 011, FR-003 y FR-027).
 */
export function AppGate({ children }: PropsWithChildren) {
  useLocale();
  const { c } = useTheme();
  const { status, unlock, signOut } = useSession();
  const router = useRouter();
  const segments = useSegments();
  const [outdated, setOutdated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void mustUpdate().then((value) => !cancelled && setOutdated(value));
    return () => {
      cancelled = true;
    };
  }, []);

  const first = segments[0] as string | undefined;

  useEffect(() => {
    if (outdated === null || status === "loading") return;
    if (outdated) {
      if (first !== "actualizar") router.replace("/actualizar");
    } else if (status === "signedOut") {
      if (first !== "(auth)") router.replace("/(auth)/login");
    } else if (status === "signedIn" && (first === "(auth)" || first === "actualizar" || first === undefined)) {
      router.replace("/(tabs)/ordenes");
    }
  }, [outdated, status, first, router]);

  if (outdated === null || status === "loading") return <Splash />;

  if (!outdated && status === "locked") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <Animated.View entering={fadeIn} style={{ flex: 1, justifyContent: "center", padding: space[6], gap: space[4] }}>
          <BrandMark size={64} />
          <AppText variant="display">Draxuvo</AppText>
          <Button label={t("profile.biometric")} icon="unlock" onPress={() => void unlock()} />
          <Button label={t("profile.biometricRetry")} variant="outline" onPress={() => void signOut()} />
        </Animated.View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}
