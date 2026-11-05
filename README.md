# draxuvo-app

App móvil de **Draxuvo** para el personal: ver las órdenes asignadas, marcar pasos, agregar notas y fotos (también sin red), cobrar y compartir el ticket. En un restaurante o bar, el mesero abre mesas, manda comandas a cocina y barra, recibe el aviso de "listo" y cobra con uno o varios métodos (módulo de restaurante, sin red no se manda ni se cobra). Encargados y dueños además crean y asignan órdenes, y quien trabaja en varias empresas cambia entre ellas. Parte del [workspace Draxuvo](https://github.com/bothi3119/bothi).

Hecha con **React Native y Expo** (SDK 57, TypeScript estricto, Expo Router). Habla con la misma API que el panel (`/api/v1`, JWT, `X-Company-Id`, cabecera `locale`).

## Ecosistema

| Repositorio | Descripción |
|---|---|
| [draxuvo-api](https://github.com/Draxuvo/draxuvo-api) | API REST (Rails 8, PostgreSQL), ERP multiempresa |
| [draxuvo-ui](https://github.com/Draxuvo/draxuvo-ui) | Panel del ERP (Next.js 16) |
| [draxuvo-web](https://github.com/Draxuvo/draxuvo-web) | Sitio público (Next.js 16) |
| **draxuvo-app** | Este repositorio |

## Empezar

```bash
npm ci
cp .env.example .env.local   # EXPO_PUBLIC_API_URL; en el simulador de iOS sirve http://localhost:3000
npm start                    # o npm run ios / npm run android
```

La API local y los datos de demo salen de `scripts/dev` del workspace (contraseña de la demo en su `CLAUDE.md`). En un teléfono real, usa la IP de tu Mac en `EXPO_PUBLIC_API_URL`. La cámara, la biometría y el almacén seguro necesitan un teléfono o simulador con build de desarrollo (`eas build --profile development`); Expo Go no incluye todos los módulos.

## Pruebas y lint

```bash
npm run lint         # eslint --max-warnings 0
npm run typecheck    # tsc --noEmit
npm test             # Jest (jest-expo) con Testing Library
npm run e2e          # recorridos Maestro de e2e/ (necesita Maestro y un simulador con la app instalada)
```

Las pruebas de pantalla viven en `src/__tests__/` (no en `app/`: Expo Router toma todo lo de `app/` como ruta). Los recorridos de `e2e/` esperan la API con datos de demo (`staff@volta.demo`, `admin@volta.demo`, `multi@demo.demo`); `sin-red.yaml` usa el modo avión y solo corre en Android.

## Estructura

```text
app/                  # Expo Router: (auth), (tabs) con Órdenes, Mesas, Tickets y Perfil, empresa, cobro, cuenta, cuenta-cobro, ticket, orden-form, actualizar
src/api/              # cliente fetch y una carpeta por dominio; tipos copiados del contrato
src/session/          # sesión en SecureStore, rol por empresa, biometría opcional
src/outbox/           # cola SQLite de notas y fotos con Idempotency-Key
src/gates/            # versión mínima y guarda de arranque
src/components/       # piezas de pantalla
src/i18n/             # es.json y en.json (mismas claves; hay una prueba que lo exige)
src/theme/            # tokens de DESIGN.md
e2e/                  # recorridos Maestro
```

## Reglas que no se rompen

- **La app no decide permisos.** Solo dibuja las acciones que la API manda en `allowed_actions`; la API sigue negando lo que no corresponde.
- **Notas y fotos pasan por la cola.** Se guardan primero en el teléfono y se envían con una llave de idempotencia (UUID): reenviar nunca duplica.
- **Cada petición lleva la empresa activa** y la caché se separa por empresa.
- **Sin texto a mano en pantallas:** todo sale de `src/i18n`.

## Publicar

Compilaciones y envío a TestFlight y a la prueba interna de Google Play con EAS. Cuentas, credenciales, ficha y cómo subir la versión mínima en la API: [STORE.md](./STORE.md).

## Avisos push (spec 057)

`src/push/` registra el teléfono (`registration.ts`: token de Expo, `POST /push_devices`, baja al cerrar sesión con reintento de
24 h), pide el permiso con una hoja previa (`permission.ts`, `components/push/permission-sheet.tsx`, una vez por persona), crea
los canales de Android `orders` y `business` (`channels.ts`) y abre la pantalla del aviso al tocarlo, cambiando de empresa si
hace falta (`open.ts`, `host.tsx`). Con la app a la vista no se dibuja la notificación del sistema. «Mis avisos» en Perfil
(`components/push/my-notifications.tsx`) usa `/push_preference`.

Necesita una compilación nueva de EAS (módulo nativo `expo-notifications`) y dos variables al compilar: `EAS_PROJECT_ID`
(proyecto de EAS; sin él la app no pide token y «Mis avisos» dice que no están disponibles) y `GOOGLE_SERVICES_JSON`
(archivo de Firebase para Android, variable de archivo de EAS; en local basta con `google-services.json` en la raíz, ignorado
por git). En Jest, `expo-notifications` y `expo-device` están simulados en `jest.setup.ts`. Pasos completos en `STORE.md`.

## Lector de códigos (spec 056)

`ScanSheet` (`src/components/scan/scan-sheet.tsx`) lee códigos de barras con `expo-camera` y siempre ofrece un campo para escribirlos. `expo-camera` es un módulo nativo y agrega el permiso de cámara: requiere una compilación nueva de EAS; no llega por actualización OTA.
