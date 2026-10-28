// >>> compartido (idéntico en ui y app; lo verifica scripts/sounds-parity)
export const SOUND_IDS = [
  "cocina",
  "barra",
  "otra",
  "urgente",
  "listo",
  "clasico",
  "campana",
  "marimba",
  "gota",
  "timbre",
  "pulso",
  "arpegio",
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export const ALERT_KINDS = ["new_kitchen", "new_bar", "new_other", "urgent", "ready"] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

/** Si coinciden varias alertas, suena la de mayor prioridad: atrasada, luego comanda nueva, luego lista. */
export const ALERT_PRIORITY: readonly AlertKind[] = ["urgent", "new_kitchen", "new_bar", "new_other", "ready"];
// <<< compartido

/** Sonido por omisión en el teléfono: solo suena "lista", con el tono original de la app. */
export const DEFAULTS: Partial<Record<AlertKind, SoundId>> = {
  ready: "clasico",
};
