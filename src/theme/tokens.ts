// Tokens de DESIGN.md ("etiqueta de anaquel"), los mismos del sitio y del panel.
export const colors = {
  tinta: "#141414",
  etiqueta: "#ffffff",
  anaquel: "#eceef0",
  anaquelBorde: "#d5d9de",
  grisTexto: "#4a4f55",
  ceja: "#ffd23f",
  oferta: "#ff5a1f",
  ofertaHover: "#ff7a45",
  sello: "#0b7a4b",
  alerta: "#c62828",
  graficaNeutra: "#6b7280",
} as const;

export const radii = { interior: 4, etiqueta: 6, pastilla: 9999 } as const;

export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 10: 40, 16: 64 } as const;

/** Tamaño mínimo de toque (FR-020). */
export const MIN_TOUCH = 44;

// Sin fuentes propias en la app: se usa la del sistema, que respeta la escala de letra (FR-022).
export const typography = {
  headline: { fontSize: 28, fontWeight: "800", lineHeight: 32 },
  title: { fontSize: 20, fontWeight: "800", lineHeight: 26 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 24 },
  bodyStrong: { fontSize: 16, fontWeight: "600", lineHeight: 24 },
  label: { fontSize: 13, fontWeight: "600", lineHeight: 17, letterSpacing: 0.8 },
  cifra: { fontSize: 28, fontWeight: "600", lineHeight: 32, fontVariant: ["tabular-nums"] },
} as const;

/** Sombra de la etiqueta de anaquel: plana, un borde duro y sin desenfoque. */
export const etiquetaShadow = {
  shadowColor: colors.tinta,
  shadowOffset: { width: 2, height: 2 },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 2,
} as const;
