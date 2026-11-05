import { existsSync } from "node:fs";
import type { ExpoConfig } from "expo/config";

// Avisos push (spec 057): el proyecto de EAS y el archivo de Firebase llegan por variables de entorno (EAS o local);
// sin ellos la app compila igual y simplemente no pide token.
const easProjectId = process.env.EAS_PROJECT_ID;
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? (existsSync("./google-services.json") ? "./google-services.json" : undefined);

const config: ExpoConfig = {
  name: "Draxuvo",
  slug: "draxuvo-app",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "draxuvo",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.draxuvo.app",
    supportsTablet: false,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "com.draxuvo.app",
    ...(googleServicesFile ? { googleServicesFile } : {}),
    adaptiveIcon: {
      backgroundColor: "#2340C8",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-audio",
    "expo-sqlite",
    [
      "expo-local-authentication",
      { faceIDPermission: "Draxuvo usa Face ID para abrir tu sesión." },
    ],
    [
      "expo-image-picker",
      {
        cameraPermission: "Draxuvo usa la cámara para adjuntar fotos a tus órdenes y a tu perfil.",
        photosPermission: "Draxuvo usa tus fotos para adjuntarlas a tus órdenes y a tu perfil.",
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "Draxuvo usa la cámara para leer códigos de barras. Solo se lee el número; no se guarda ninguna imagen.",
        recordAudioAndroid: false,
      },
    ],
    [
      "expo-notifications",
      { icon: "./assets/images/android-icon-monochrome.png", color: "#2340C8" },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F1EFE9",
        image: "./assets/images/splash-icon.png",
        imageWidth: 288,
        dark: { backgroundColor: "#0E1120", image: "./assets/images/splash-icon.png" },
      },
    ],
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
};

export default config;
