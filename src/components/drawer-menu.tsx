import { useRouter } from "expo-router";
import { useEffect } from "react";
import { BackHandler, Pressable, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion, SlideInLeft, SlideOutLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t, useLocale } from "@/i18n";
import { duration, ease, radius, space, useTheme } from "@/theme";
import { useSession } from "@/session";
import { useDrawer } from "./drawer-context";
import { LanguageSwitch } from "./language-switch";
import { Monogram } from "./order-card";
import { AppText, Button, Divider, Icon } from "./ui";

/** Cajón lateral: empresa activa, cambio de empresa, idioma y cerrar sesión. */
export function DrawerMenu() {
  useLocale();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isOpen, close } = useDrawer();
  const { user, companyId, role, signOut } = useSession();

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);

  if (!isOpen || !user) return null;
  const company = user.companies.find((item) => item.id === companyId);
  const many = user.companies.length > 1;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 20 }} pointerEvents="box-none">
      <Animated.View entering={FadeIn.duration(duration.base).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(duration.quick)} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: c.scrim }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("menu.close")} onPress={close} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View
        entering={SlideInLeft.duration(duration.slow).easing(ease).reduceMotion(ReduceMotion.System)}
        exiting={SlideOutLeft.duration(duration.base).easing(ease)}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "84%",
          maxWidth: 340,
          backgroundColor: c.background,
          borderTopRightRadius: radius.sheet,
          borderBottomRightRadius: radius.sheet,
          paddingTop: insets.top + space[4],
          paddingBottom: insets.bottom + space[4],
        }}
      >
        <ScrollView contentContainerStyle={{ padding: space[5], gap: space[5] }}>
          <View style={{ gap: space[3] }}>
            <Monogram name={company?.name ?? fullName} size={56} />
            <View>
              <AppText variant="headline" numberOfLines={2}>
                {company?.name ?? ""}
              </AppText>
              <AppText tone="muted">
                {fullName}
                {role ? ` · ${t(`company.roles.${role}`)}` : ""}
              </AppText>
            </View>
          </View>
          <Divider />
          {many ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("company.title")}
              onPress={() => {
                close();
                router.push("/empresa");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 }}
            >
              <Icon name="repeat" />
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {t("company.title")}
              </AppText>
              <Icon name="chevron-right" tone="muted" />
            </Pressable>
          ) : null}
          <LanguageSwitch />
        </ScrollView>
        <View style={{ paddingHorizontal: space[5] }}>
          <Button
            label={t("profile.logout")}
            variant="outline"
            icon="log-out"
            onPress={() => {
              close();
              void signOut();
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}
