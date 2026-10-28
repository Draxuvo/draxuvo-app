import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import { DEFAULTS, type SoundId } from "./sounds/catalog";
import { SOUND_SOURCES } from "./sounds/sources";

// Un reproductor por sonido, creado la primera vez; solo suena uno a la vez (no se depende del solape).
const players = new Map<SoundId, AudioPlayer>();
let playing: AudioPlayer | null = null;

function playerFor(id: SoundId): AudioPlayer | null {
  try {
    let player = players.get(id);
    if (!player) {
      player = createAudioPlayer(SOUND_SOURCES[id]);
      players.set(id, player);
    }
    return player;
  } catch {
    return null;
  }
}

/** Reproduce un sonido del catálogo. `volume` va de 0.0 a 1.0. Devuelve `false` si no pudo. */
export function playSound(id: SoundId, volume: number): boolean {
  if (!(id in SOUND_SOURCES)) return false;
  const audio = playerFor(id);
  if (!audio) return false;
  try {
    if (playing && playing !== audio) playing.pause();
    audio.volume = Math.min(1, Math.max(0, volume));
    void audio.seekTo(0).catch(() => {});
    audio.play();
    playing = audio;
    return true;
  } catch {
    return false;
  }
}

/** Reproduce el sonido de "listo" para el mesero (por omisión, el original de la app). */
export function playReadySound(volume: number, id: SoundId = DEFAULTS.ready ?? "clasico"): boolean {
  return playSound(id, volume);
}

/** Solo para pruebas. */
export function resetSoundPlayers(): void {
  players.clear();
  playing = null;
}
