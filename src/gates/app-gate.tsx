import { useRouter, useSegments } from "expo-router";
import { useEffect, useState, type PropsWithChildren } from "react";
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Button } from "@/components/ui";
import { t, useLocale } from "@/i18n";
import { useSession } from "@/session";
import { colors, spacing } from "@/theme";
import { mustUpdate } from "./version";

/**
 * Decide qué se ve al abrir: versión no compatible, entrada, bloqueo biométrico o la app.
 * Las pantallas no repiten esta lógica (spec 011, FR-003 y FR-027).
 */
export function AppGate({ children }: PropsWithChildren) {
  useLocale();
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

  if (outdated === null || status === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", backgroundColor: colors.anaquel }}>
        <ActivityIndicator color={colors.tinta} />
      </SafeAreaView>
    );
  }

  if (!outdated && status === "locked") {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: spacing[6], gap: spacing[4], backgroundColor: colors.anaquel }}>
        <AppText variant="headline">Draxuvo</AppText>
        <Button label={t("profile.biometric")} onPress={() => void unlock()} />
        <Button label={t("profile.biometricRetry")} variant="outline" onPress={() => void signOut()} />
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}
