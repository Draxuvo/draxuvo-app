// Mundo "Parte de trabajo" (ver DESIGN.md de la app): papel, tinta azul de bolígrafo,
// marcador amarillo y sellos de estado. Claro y oscuro son esquemas de primera clase.
export const palette = {
  light: {
    background: "#F1EFE9",
    surface: "#FFFFFF",
    surfaceAlt: "#E8E5DB",
    ink: "#141B2D",
    inkMuted: "#565D70",
    line: "#D8D3C6",
    primary: "#2340C8",
    onPrimary: "#FFFFFF",
    primarySoft: "#E1E6FB",
    onPrimarySoft: "#1A2E8F",
    marker: "#FFE14D",
    onMarker: "#141B2D",
    stamp: "#C92F26",
    stampSoft: "#FBE3E0",
    onStampSoft: "#8E1C15",
    ok: "#13795A",
    okSoft: "#D8F0E6",
    onOkSoft: "#0D5740",
    scrim: "rgba(20,27,45,0.5)",
  },
  dark: {
    background: "#0E1120",
    surface: "#171B2E",
    surfaceAlt: "#20253B",
    ink: "#ECEBF5",
    inkMuted: "#A3A9BE",
    line: "#2C3250",
    primary: "#9DB0FF",
    onPrimary: "#0B1235",
    primarySoft: "#26306B",
    onPrimarySoft: "#D5DDFF",
    marker: "#FFE14D",
    onMarker: "#141B2D",
    stamp: "#FF8F86",
    stampSoft: "#4A1E1C",
    onStampSoft: "#FFD6D2",
    ok: "#5ED1A3",
    okSoft: "#14443A",
    onOkSoft: "#C4F2E2",
    scrim: "rgba(0,0,0,0.6)",
  },
} as const;

export type Colors = { [K in keyof typeof palette.light]: string };

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;
export const radius = { field: 14, card: 16, sheet: 28, chip: 12, pill: 999 } as const;

/** Tamaño mínimo de toque en Android (Material): 48 dp. */
export const MIN_TOUCH = 48;
export const TAB_BAR_HEIGHT = 68;

export const fontFamily = {
  display: "Bricolage_800ExtraBold",
  displayBold: "Bricolage_700Bold",
  body: "Hanken_400Regular",
  bodyMedium: "Hanken_500Medium",
  bodyStrong: "Hanken_600SemiBold",
  bodyBold: "Hanken_700Bold",
} as const;

// Escala de roles (Material 3): cada texto de la app usa un rol, no un tamaño suelto.
export const typeScale = {
  display: { fontFamily: fontFamily.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  headline: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  title: { fontFamily: fontFamily.displayBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  bodyLarge: { fontFamily: fontFamily.body, fontSize: 17, lineHeight: 25 },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.bodyStrong, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fontFamily.bodyStrong, fontSize: 12.5, lineHeight: 16, letterSpacing: 0.6 },
  figure: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, fontVariant: ["tabular-nums"] },
  figureLarge: { fontFamily: fontFamily.display, fontSize: 52, lineHeight: 56, letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
} as const;

export type TypeRole = keyof typeof typeScale;
