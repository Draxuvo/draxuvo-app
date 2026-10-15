import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { describeError } from "@/components/error-view";
import { AppText, Button, Field } from "@/components/ui";
import { t } from "@/i18n";
import { NoCompanyError, useSession } from "@/session";
import { colors, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateLogin(email: string, password: string) {
  const errors: { email?: string; password?: string } = {};
  if (!email.trim()) errors.email = t("login.emailRequired");
  else if (!EMAIL.test(email.trim())) errors.email = t("login.emailInvalid");
  if (!password) errors.password = t("login.passwordRequired");
  return errors;
}

/** Mensaje del servidor para credenciales malas o cuenta inactiva; el resto, el genérico. */
function loginMessage(error: unknown): string {
  if (error instanceof NoCompanyError) return t("login.noCompany");
  if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status) && typeof error.details === "string") {
    return error.details;
  }
  return describeError(error);
}

export default function Login() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const found = validateLogin(email, password);
    setErrors(found);
    setFormError(null);
    if (found.email || found.password) return;
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(loginMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.anaquel }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing[6], gap: spacing[4] }} keyboardShouldPersistTaps="handled">
          <AppText variant="headline" accessibilityRole="header">
            {t("login.title")}
          </AppText>
          <Field
            label={t("login.email")}
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            testID="login-email"
          />
          <Field
            label={t("login.password")}
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            testID="login-password"
          />
          {formError ? (
            <View accessibilityRole="alert">
              <AppText style={{ color: colors.alerta }} testID="login-error">
                {formError}
              </AppText>
            </View>
          ) : null}
          <Button label={t("login.submit")} onPress={() => void submit()} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
