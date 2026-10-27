import { createAudioPlayer } from "expo-audio";
import type { AudioPlayer } from "expo-audio";

let player: AudioPlayer | null = null;

function ensurePlayer(): AudioPlayer | null {
  try {
    player ??= createAudioPlayer(require("../../assets/sounds/ready.wav"));
    return player;
  } catch {
    return null;
  }
}

/** Reproduce el tono de "listo" para el mesero. `volume` va de 0.0 a 1.0. */
export function playReadySound(volume: number): void {
  const audio = ensurePlayer();
  if (!audio) return;
  audio.volume = Math.min(1, Math.max(0, volume));
  void audio.seekTo(0).catch(() => {});
  audio.play();
}
