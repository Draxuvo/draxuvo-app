# Diseño de la app: "Parte de trabajo"

La app móvil tiene su propio mundo visual, distinto del sitio y del panel (que siguen con "Etiqueta de anaquel" en el `DESIGN.md` del workspace). Es una herramienta de campo: se usa de pie, con una mano, a veces al sol. La app se siente como la hoja de servicio que el técnico llena y sella.

## Dirección

- **Papel**: fondo cálido y apagado (`background`), hojas blancas encima (`surface`). Sin sombras: la profundidad es capa más borde de 1px.
- **Tinta azul de bolígrafo** (`primary`) para la acción principal y lo elegido. Texto sobre ella siempre `onPrimary`.
- **Marcador amarillo** (`marker`) para lo que importa ahora: la pestaña activa, el botón flotante, el conteo, "en proceso", el cambio a devolver. Texto encima siempre `onMarker` (tinta).
- **Sellos de estado**: rojo (`stamp`) para urgente, error y destructivo; verde (`ok`) para hecho y cobrado. Las etiquetas de estado giran −3° como un sello de goma.
- Claro y oscuro son esquemas de primera clase y siguen al teléfono (`useTheme`).

## Tipografía

Dos familias: **Bricolage Grotesque** (800 y 700) para títulos y cifras, **Hanken Grotesk** (400 a 700) para el texto. Se usa una escala de roles (`display`, `headline`, `title`, `bodyLarge`, `body`, `bodyStrong`, `label`, `figure`, `figureLarge`) en `src/theme/tokens.ts`; ninguna pantalla elige un tamaño suelto. Las cifras (dinero, folios) llevan `tabular-nums`.

## Forma y componentes

- Radios: 14 en botones y campos, 16 en tarjetas, 28 en cajón y barra de acciones, píldora en chips.
- Toque mínimo 48 dp. Botones de 52 dp.
- **Tarjeta de orden**: talón con el folio a la izquierda, perforado, y el contenido a la derecha. El avance son segmentos, uno por paso.
- **Ticket**: recibo con borde en zigzag y el sello "COBRADO" que cae al abrirlo.
- Íconos: Feather, un solo trazo. Ilustraciones: geometría vectorial propia (`illustrations.tsx`).

## Navegación

Barra inferior de tres destinos (Órdenes, Tickets, Perfil) con indicador amarillo animado; cajón lateral (empresa activa, cambio de empresa, idioma, cerrar sesión) desde el botón de menú; botón flotante extendido "Nueva orden" solo para encargado o superior, que se encoge al bajar la lista. El detalle de una orden oculta la barra inferior y fija su barra de acciones abajo.

## Movimiento

Una curva (exponencial de salida) y tres duraciones (140, 260 y 420 ms) en `src/theme/motion.ts`.

- Entrada escalonada de filas (45 ms entre filas, tope de 8).
- Resorte corto al presionar y respuesta háptica ligera.
- Pasos con palomita que rebota; segmentos de avance que se llenan.
- Sello de estado que cae al aparecer o cambiar; sello de cobrado en el ticket.
- Esqueletos de carga con la forma de lo que viene; formularios que se sacuden al fallar.
- Todo respeta "Quitar animaciones" del sistema (`ReduceMotion.System`).

## Reglas

- Texto sobre `primary` es `onPrimary`; sobre `marker`, `onMarker`. Nunca gris sobre color.
- Un solo marcador amarillo por pantalla de trabajo.
- Sin gradientes, sin sombras decorativas (solo el botón flotante, que flota de verdad).
- Todo texto sale de `src/i18n`.
