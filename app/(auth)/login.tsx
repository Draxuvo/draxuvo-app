import { useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "@/api/client";
import { BrandLockup } from "@/components/brand";
import { describeError } from "@/components/error-view";
import { AppText, Button, Field, Icon } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import { t } from "@/i18n";
import { NoCompanyError, useSession } from "@/session";
import { rowEnter, space, useTheme } from "@/theme";

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
  const { c } = useTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  // El formulario se sacude un poco cuando algo falla, para que se note sin leer.
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const fail = () => {
    haptic.warning();
    shake.set(withSequence(withTiming(-8, { duration: 50 }), withTiming(8, { duration: 80 }), withTiming(-5, { duration: 70 }), withTiming(0, { duration: 60 })));
  };

  const submit = async () => {
    const found = validateLogin(email, password);
    setErrors(found);
    setFormError(null);
    if (found.email || found.password) return fail();
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(loginMessage(error));
      fail();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space[6], gap: space[8], justifyContent: "center" }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={rowEnter(0)} style={{ gap: space[8] }}>
            <BrandLockup />
            <View style={{ gap: space[2] }}>
              <AppText variant="display" accessibilityRole="header">
                {t("login.title")}
              </AppText>
              <AppText variant="bodyLarge" tone="muted">
                {t("login.subtitle")}
              </AppText>
            </View>
          </Animated.View>

          <Animated.View entering={rowEnter(2)}>
          <Animated.View style={[{ gap: space[4] }, shakeStyle]}>
            <Field
              label={t("login.email")}
              icon="mail"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              testID="login-email"
            />
            <View>
              <Field
                label={t("login.password")}
                icon="lock"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secureTextEntry={!show}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void submit()}
                inputRef={passwordRef}
                testID="login-password"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(show ? "login.hidePassword" : "login.showPassword")}
                onPress={() => setShow((value) => !value)}
                hitSlop={8}
                style={{ position: "absolute", right: 0, top: 19, width: 52, height: 54, alignItems: "center", justifyContent: "center" }}
              >
                <Icon name={show ? "eye-off" : "eye"} tone="muted" />
              </Pressable>
            </View>
            {formError ? (
              <View accessibilityRole="alert" style={{ backgroundColor: c.stampSoft, borderRadius: 12, padding: space[3], flexDirection: "row", gap: space[2], alignItems: "center" }}>
                <Icon name="alert-circle" tone="stamp" />
                <AppText testID="login-error" style={{ color: c.onStampSoft, flex: 1 }}>
                  {formError}
                </AppText>
              </View>
            ) : null}
            <Button label={t("login.submit")} icon="arrow-right" onPress={() => void submit()} loading={busy} />
          </Animated.View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
