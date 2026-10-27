import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import Animated from "react-native-reanimated";
import { updateProfile } from "@/api/profile";
import { AttendanceCard } from "@/components/attendance/attendance-card";
import { useLogoutFlow } from "@/components/attendance/logout-modal";
import { AvatarPicker } from "@/components/avatar-picker";
import { describeError } from "@/components/error-view";
import { LanguageSwitch } from "@/components/language-switch";
import { Monogram } from "@/components/order-card";
import { AppText, Button, Card, Field, Icon, KeyboardFrame } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import { useSoundPreference } from "@/hooks/use-sound-preference";
import { t, useLocale } from "@/i18n";
import { biometricAvailable } from "@/session/biometric";
import { useSession } from "@/session";
import { rowEnter, space, TAB_BAR_HEIGHT, useTheme } from "@/theme";

export default function Perfil() {
  useLocale();
  const { c } = useTheme();
  const { user, companyId, role, setUser, biometricEnabled, setBiometricEnabled } = useSession();
  const sound = useSoundPreference("ready");
  const router = useRouter();
  const { requestLogout, modal: logoutModal } = useLogoutFlow();
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;
  const company = user.companies.find((item) => item.id === companyId);
  const many = user.companies.length > 1;

  const save = async () => {
    if (!firstName.trim()) {
      haptic.warning();
      return setNameError(t("profileScreen.nameRequired"));
    }
    setNameError(null);
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() });
      await setUser({ ...user, ...updated, companies: updated.companies ?? user.companies });
      haptic.success();
      setMessage({ text: t("profileScreen.saved"), error: false });
    } catch (error) {
      haptic.warning();
      setMessage({ text: describeError(error), error: true });
    } finally {
      setSaving(false);
    }
  };

  const toggleBiometric = async (enabled: boolean) => {
    if (enabled && !(await biometricAvailable())) {
      return setMessage({ text: t("profileScreen.biometricUnavailable"), error: true });
    }
    await setBiometricEnabled(enabled);
  };

  return (
    <KeyboardFrame>
<Animated.ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: TAB_BAR_HEIGHT + space[8] }} keyboardShouldPersistTaps="handled">
      <Animated.View entering={rowEnter(0)}>
        <Card>
          <AvatarPicker user={user} onChange={(updated) => void setUser({ ...user, ...updated, companies: updated.companies ?? user.companies })} />
        </Card>
      </Animated.View>

      {company ? (
        <Animated.View entering={rowEnter(1)}>
          <Card style={{ gap: space[3] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
              <Monogram name={company.name} size={48} />
              <AppText variant="headline" numberOfLines={2} style={{ flex: 1 }}>
                {company.name}
              </AppText>
            </View>
            {many ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("company.title")}
                onPress={() => router.push("/empresa")}
                style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 }}
              >
                <Icon name="repeat" />
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {t("company.title")}
                </AppText>
                <Icon name="chevron-right" tone="muted" />
              </Pressable>
            ) : null}
          </Card>
        </Animated.View>
      ) : null}

      <AttendanceCard />

      {role === "admin" || role === "owner" ? (
        <Animated.View entering={rowEnter(1)}>
          <Card>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("teamAttendance.entry")}
              onPress={() => router.push("/asistencia-equipo")}
              style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 }}
            >
              <Icon name="users" />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{t("teamAttendance.entry")}</AppText>
                <AppText tone="muted">{t("teamAttendance.entryHint")}</AppText>
              </View>
              <Icon name="chevron-right" tone="muted" />
            </Pressable>
          </Card>
        </Animated.View>
      ) : null}

      <Animated.View entering={rowEnter(1)}>
        <Card style={{ gap: space[4] }}>
          <Field label={t("profileScreen.firstName")} value={firstName} onChangeText={setFirstName} error={nameError} testID="profile-first-name" />
          <Field label={t("profileScreen.lastName")} value={lastName} onChangeText={setLastName} />
          <Field label={t("profileScreen.phone")} icon="phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label={t("profileScreen.email")} icon="mail" value={user.email} editable={false} />
          <Field label={t("profileScreen.role")} icon="shield" value={role ? t(`company.roles.${role}`) : ""} editable={false} />
          <Button label={t("profileScreen.save")} icon="check" onPress={() => void save()} loading={saving} />
          {message ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
              <Icon name={message.error ? "alert-circle" : "check-circle"} tone={message.error ? "stamp" : "ok"} />
              <AppText tone={message.error ? "stamp" : "ok"} accessibilityLiveRegion="polite" testID="profile-message" style={{ flex: 1 }}>
                {message.text}
              </AppText>
            </View>
          ) : null}
        </Card>
      </Animated.View>

      <Animated.View entering={rowEnter(2)}>
        <Card style={{ gap: space[4] }}>
          <LanguageSwitch />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[3], minHeight: 48 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], flex: 1 }}>
              <Icon name="bell" tone="muted" />
              <AppText style={{ flexShrink: 1 }}>{t("profile.sound")}</AppText>
            </View>
            <Switch
              accessibilityLabel={t("profile.sound")}
              value={sound.enabled}
              onValueChange={(value) => {
                haptic.select();
                sound.setEnabled(value);
              }}
              trackColor={{ true: c.primary, false: c.line }}
              thumbColor={c.surface}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[3], minHeight: 48 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], flex: 1 }}>
              <Icon name="smartphone" tone="muted" />
              <AppText style={{ flexShrink: 1 }}>{t("profile.biometric")}</AppText>
            </View>
            <Switch
              accessibilityLabel={t("profile.biometric")}
              value={biometricEnabled}
              onValueChange={(value) => {
                haptic.select();
                void toggleBiometric(value);
              }}
              trackColor={{ true: c.primary, false: c.line }}
              thumbColor={c.surface}
            />
          </View>
        </Card>
      </Animated.View>

      <Button label={t("profile.logout")} variant="outline" icon="log-out" onPress={requestLogout} />
      {logoutModal}
    </Animated.ScrollView>
</KeyboardFrame>
  );
}
