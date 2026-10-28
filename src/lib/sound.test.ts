import { createAudioPlayer } from "expo-audio";
import { playReadySound, playSound, resetSoundPlayers } from "./sound";

const created = createAudioPlayer as jest.Mock;

describe("playSound", () => {
  beforeEach(() => {
    resetSoundPlayers();
    created.mockClear();
  });

  it("crea un reproductor por sonido, una sola vez, y aplica el volumen", () => {
    expect(playSound("campana", 0.4)).toBe(true);
    expect(playSound("campana", 0.4)).toBe(true);
    expect(created).toHaveBeenCalledTimes(1);
    const player = created.mock.results[0].value;
    expect(player.volume).toBe(0.4);
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it("pausa el sonido anterior antes de empezar otro", () => {
    playSound("campana", 1);
    playSound("gota", 1);
    const [first] = created.mock.results.map((r) => r.value);
    expect(first.pause).toHaveBeenCalledTimes(1);
  });

  it("limita el volumen a 0–1", () => {
    playSound("pulso", 5);
    expect(created.mock.results[0].value.volume).toBe(1);
  });

  it("un id desconocido o un fallo del reproductor devuelven false", () => {
    expect(playSound("nope" as never, 1)).toBe(false);
    created.mockImplementationOnce(() => {
      throw new Error("sin audio");
    });
    expect(playSound("timbre", 1)).toBe(false);
  });

  it("'lista' suena por omisión con clasico", () => {
    expect(playReadySound(1)).toBe(true);
    expect(created).toHaveBeenCalledWith(require("../../assets/sounds/clasico.wav"));
  });
});
