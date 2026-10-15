import { useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { updateProfile } from "@/api/profile";
import { AvatarPicker } from "@/components/avatar-picker";
import { describeError } from "@/components/error-view";
import { LanguageSwitch } from "@/components/language-switch";
import { AppText, Button, Card, Field } from "@/components/ui";
import { t, useLocale } from "@/i18n";
import { biometricAvailable } from "@/session/biometric";
import { useSession } from "@/session";
import { colors, spacing } from "@/theme";

export default function Perfil() {
  useLocale();
  const { user, role, setUser, signOut, biometricEnabled, setBiometricEnabled } = useSession();
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const save = async () => {
    if (!firstName.trim()) return setNameError(t("profileScreen.nameRequired"));
    setNameError(null);
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() });
      await setUser({ ...user, ...updated, companies: updated.companies ?? user.companies });
      setMessage({ text: t("profileScreen.saved"), error: false });
    } catch (error) {
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
    <ScrollView style={{ backgroundColor: colors.anaquel }} contentContainerStyle={{ padding: spacing[4], gap: spacing[4] }} keyboardShouldPersistTaps="handled">
      <Card>
        <AvatarPicker user={user} onChange={(updated) => void setUser({ ...user, ...updated, companies: updated.companies ?? user.companies })} />
      </Card>

      <Card>
        <Field label={t("profileScreen.firstName")} value={firstName} onChangeText={setFirstName} error={nameError} testID="profile-first-name" />
        <Field label={t("profileScreen.lastName")} value={lastName} onChangeText={setLastName} />
        <Field label={t("profileScreen.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Field label={t("profileScreen.email")} value={user.email} editable={false} />
        <Field label={t("profileScreen.role")} value={role ? t(`company.roles.${role}`) : ""} editable={false} />
        <Button label={t("profileScreen.save")} onPress={() => void save()} loading={saving} />
        {message ? (
          <AppText style={{ color: message.error ? colors.alerta : colors.sello }} accessibilityLiveRegion="polite" testID="profile-message">
            {message.text}
          </AppText>
        ) : null}
      </Card>

      <Card>
        <LanguageSwitch />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing[3], minHeight: 44 }}>
          <AppText style={{ flexShrink: 1 }}>{t("profile.biometric")}</AppText>
          <Switch accessibilityLabel={t("profile.biometric")} value={biometricEnabled} onValueChange={(value) => void toggleBiometric(value)} />
        </View>
      </Card>

      <Button label={t("profile.logout")} variant="outline" onPress={() => void signOut()} />
    </ScrollView>
  );
}
