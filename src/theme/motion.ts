import { Easing, ReduceMotion, FadeIn, FadeInDown, FadeInUp, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";

// Una sola curva (exponencial de salida) y tres duraciones. Todo respeta "Quitar animaciones" del sistema.
export const ease = Easing.bezier(0.16, 1, 0.3, 1);
export const duration = { quick: 140, base: 260, slow: 420 } as const;

/** Entrada escalonada de una fila: sube 14 px y aparece; tope de 8 filas para no hacer esperar. */
export const rowEnter = (index: number) =>
  FadeInDown.delay(Math.min(index, 8) * 45)
    .duration(duration.base + 60)
    .easing(ease)
    .reduceMotion(ReduceMotion.System);

export const fadeIn = FadeIn.duration(duration.base).easing(ease).reduceMotion(ReduceMotion.System);
export const fadeOut = FadeOut.duration(duration.quick).reduceMotion(ReduceMotion.System);
export const riseIn = FadeInUp.duration(duration.slow).easing(ease).reduceMotion(ReduceMotion.System);
export const sheetIn = SlideInDown.duration(duration.slow).easing(ease).reduceMotion(ReduceMotion.System);
export const sheetOut = SlideOutDown.duration(duration.base).easing(ease).reduceMotion(ReduceMotion.System);
