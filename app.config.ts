import type { ExpoConfig } from "expo/config";

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
  },
};

export default config;
