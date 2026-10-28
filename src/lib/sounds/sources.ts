import type { SoundId } from "./catalog";

// Metro necesita `require` con ruta literal: no se puede armar el nombre en tiempo de ejecución.
export const SOUND_SOURCES: Record<SoundId, number> = {
  cocina: require("../../../assets/sounds/cocina.wav"),
  barra: require("../../../assets/sounds/barra.wav"),
  otra: require("../../../assets/sounds/otra.wav"),
  urgente: require("../../../assets/sounds/urgente.wav"),
  listo: require("../../../assets/sounds/listo.wav"),
  clasico: require("../../../assets/sounds/clasico.wav"),
  campana: require("../../../assets/sounds/campana.wav"),
  marimba: require("../../../assets/sounds/marimba.wav"),
  gota: require("../../../assets/sounds/gota.wav"),
  timbre: require("../../../assets/sounds/timbre.wav"),
  pulso: require("../../../assets/sounds/pulso.wav"),
  arpegio: require("../../../assets/sounds/arpegio.wav"),
};
