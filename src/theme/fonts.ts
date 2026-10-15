import { useFonts } from "expo-font";
import { fontFamily } from "./tokens";

// Se cargan solo los pesos que usa la app (el índice del paquete empaquetaría todos).
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    [fontFamily.display]: require("@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"),
    [fontFamily.displayBold]: require("@expo-google-fonts/bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf"),
    [fontFamily.body]: require("@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf"),
    [fontFamily.bodyMedium]: require("@expo-google-fonts/hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf"),
    [fontFamily.bodyStrong]: require("@expo-google-fonts/hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf"),
    [fontFamily.bodyBold]: require("@expo-google-fonts/hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf"),
  });
  // Si una fuente falla, la app sigue con la del sistema en lugar de quedarse en blanco.
  return loaded || !!error;
}
