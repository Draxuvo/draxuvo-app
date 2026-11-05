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

// expo-notifications (spec 057): sin servicio de avisos en Jest. El permiso se controla con `__setPushPermission`; una
// prueba simula que llega un aviso con `__emitNotification` o que la persona lo toca con `__emitNotificationResponse`
// (o con `__setLastResponse` para el caso de la app cerrada). Como Expo, el aviso tocado queda como «último» hasta que
// se limpia; cada aviso tiene su propio identificador.
type MockListener = (event: unknown) => void;
jest.mock("expo-notifications", () => {
  let permission = { status: "undetermined", granted: false, canAskAgain: true };
  let lastResponse: unknown = null;
  const received = new Set<MockListener>();
  const responses = new Set<MockListener>();
  let sequence = 0;
  const notification = (data: Record<string, unknown>, title = "", body = "") => ({
    request: { identifier: `n${++sequence}`, content: { title, body, data } },
    date: Date.now(),
  });
  const listen = (set: Set<MockListener>) => (cb: MockListener) => {
    set.add(cb);
    return { remove: () => set.delete(cb) };
  };
  return {
    AndroidImportance: { DEFAULT: 3, HIGH: 4 },
    getPermissionsAsync: jest.fn(async () => permission),
    requestPermissionsAsync: jest.fn(async () => {
      permission = { status: "granted", granted: true, canAskAgain: true };
      return permission;
    }),
    getExpoPushTokenAsync: jest.fn(async () => ({ type: "expo", data: "ExponentPushToken[test-token-123456]" })),
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => null),
    addNotificationReceivedListener: jest.fn(listen(received)),
    addNotificationResponseReceivedListener: jest.fn(listen(responses)),
    getLastNotificationResponseAsync: jest.fn(async () => lastResponse),
    clearLastNotificationResponseAsync: jest.fn(async () => {
      lastResponse = null;
    }),
    dismissAllNotificationsAsync: jest.fn(async () => {}),
    __setPushPermission: (value: typeof permission) => {
      permission = value;
    },
    __setLastResponse: (data: Record<string, unknown> | null) => {
      lastResponse = data ? { notification: notification(data), actionIdentifier: "default" } : null;
    },
    __emitNotification: (data: Record<string, unknown>, title?: string, body?: string) =>
      received.forEach((cb) => cb(notification(data, title, body))),
    __emitNotificationResponse: (data: Record<string, unknown>) => {
      lastResponse = { notification: notification(data), actionIdentifier: "default" };
      responses.forEach((cb) => cb(lastResponse));
    },
  };
});

jest.mock("expo-device", () => ({ isDevice: true }));
