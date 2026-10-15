import * as LocalAuthentication from "expo-local-authentication";
import { t } from "@/i18n";

/** Fallos seguidos tras los cuales se pide la contraseña (FR-026). */
export const MAX_BIOMETRIC_FAILURES = 3;

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

/**
 * Pide huella o rostro. Devuelve `true` si pasó; tras `MAX_BIOMETRIC_FAILURES` intentos fallidos
 * devuelve `false` y quien llama manda a la contraseña.
 */
export async function authenticateBiometric(): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_BIOMETRIC_FAILURES; attempt++) {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t("profile.biometricReason"),
        cancelLabel: t("common.cancel"),
        disableDeviceFallback: true,
      });
      if (result.success) return true;
      if ("error" in result && (result.error === "user_cancel" || result.error === "system_cancel")) return false;
    } catch {
      return false;
    }
  }
  return false;
}
