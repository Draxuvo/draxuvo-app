// Módulos nativos que Jest no tiene: se simulan una vez aquí para que cada prueba solo
// reemplace lo que le importa.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
  };
});

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));

jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [{ languageCode: "es" }]),
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => () => {}),
    fetch: jest.fn(async () => ({ isConnected: true })),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// Animaciones: en pruebas se resuelven al instante.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => ({ ...require("react-native-reanimated/mock"), useReducedMotion: () => false }));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

jest.mock("expo-audio", () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(async () => {}),
    volume: 1,
    remove: jest.fn(),
  })),
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(async () => {}),
    volume: 1,
  })),
  setAudioModeAsync: jest.fn(async () => {}),
}));

// expo-camera (spec 056): la cámara real no existe en Jest. `CameraView` expone sus props para que cada prueba
// dispare `onBarcodeScanned`, y el permiso se controla con `__setCameraPermission`.
jest.mock("expo-camera", () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { View } = require("react-native");
  const React = require("react");
  /* eslint-enable @typescript-eslint/no-require-imports */
  let permission: { granted: boolean; canAskAgain: boolean } | null = { granted: true, canAskAgain: true };
  const request = jest.fn(async () => permission);
  return {
    CameraView: (props: Record<string, unknown>) => React.createElement(View, { testID: "camera-view", ...props }),
    useCameraPermissions: () => [permission, request],
    __setCameraPermission: (value: typeof permission) => {
      permission = value;
    },
    __requestPermission: request,
  };
});
