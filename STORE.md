# Publicar Draxuvo en las tiendas

Guía para sacar la app a TestFlight (iOS) y a la prueba interna de Google Play (Android). Los pasos 1 a 4 son manuales y los hace una persona con acceso a las cuentas; después todo corre desde `eas-build.yml`.

## 1. Cuentas

| Qué | Dónde | Notas |
|---|---|---|
| Apple Developer Program | developer.apple.com | Cuesta al año. Crea el App ID `com.draxuvo.app` y la app en App Store Connect. |
| Google Play Console | play.google.com/console | Pago único. Crea la app `com.draxuvo.app` y activa la prueba interna. |
| Expo (EAS) | expo.dev | Crea el proyecto `draxuvo-app` (`npx eas-cli init`) y un token de acceso. |

## 2. Identificadores y credenciales

- iOS bundle id y Android package: `com.draxuvo.app` (ya en `app.config.ts`).
- Certificados y llaves de firma: déjalos que los administre EAS (`eas credentials`). No se suben al repo.
- Para enviar a TestFlight: en `eas.json` → `submit.production.ios` agrega `ascAppId` (id numérico de la app en App Store Connect) o configura la llave de API de App Store Connect con `eas credentials`.
- Para enviar a Google Play: sube la cuenta de servicio de Google con `eas credentials` (la primera versión de Android se sube a mano en la consola).

## 3. Secretos y variables

| Dónde | Nombre | Valor |
|---|---|---|
| GitHub → Secrets | `EXPO_TOKEN` | Token de acceso de Expo |
| EAS (`eas env:create`) | `EXPO_PUBLIC_API_URL` | URL de la API por entorno: `development`, `preview` (con datos de demo, la usan los recorridos Maestro) y `production` |

## 4. Ficha de la tienda

- **Nombre**: Draxuvo. **Categoría**: Negocios.
- **Descripción corta**: Tus órdenes, fotos y cobros del negocio, en el teléfono.
- **Descripción**: Draxuvo es la app del personal de tu negocio. Mira las órdenes que te tocan, marca los pasos, agrega notas y fotos (aunque no haya señal, se envían al volver la red), cobra y comparte el ticket. Encargados y dueños también crean y asignan órdenes. Necesitas una cuenta de una empresa que use Draxuvo.
- **Capturas**: lista de órdenes, detalle con pasos y fotos, cobro y ticket, en iPhone de 6,7" y en un teléfono Android.
- **Política de privacidad**: publícala en el sitio (`draxuvo-web`) y pon su URL en ambas tiendas. Debe decir que la app guarda correo, nombre, teléfono, fotos de órdenes y de perfil; que usa la cámara y la galería solo cuando la persona lo pide; que la huella o el rostro se validan en el teléfono y no salen de él; que no hay publicidad ni rastreo.
- **Datos para Apple/Google**: la app no usa rastreo; recopila datos de contacto y contenido de usuario, ligados a la cuenta, para el funcionamiento de la app.
- **Cuenta de revisión**: crea una empresa de prueba y entrega `dueno@` y `staff@` con contraseña al revisor.

## 5. Compilar y enviar

```bash
# Desde GitHub: Actions → eas-build → Run workflow (perfil preview o production, con o sin envío)
# O al subir una etiqueta de versión, que compila y envía production:
git tag v1.0.0 && git push origin v1.0.0
```

Los perfiles `development`, `preview`, `production` y `e2e` están en `eas.json`. `production` sube el número de compilación solo.

## 6. Versión mínima

La API publica la versión mínima en `GET /api/v1/app_config`. Una app más vieja que la mínima de su plataforma solo ve la pantalla "Actualiza la app".

1. Publica la versión nueva en la tienda y espera a que esté disponible.
2. En Render, servicio de la API, define `MIN_APP_VERSION_IOS` y `MIN_APP_VERSION_ANDROID` (por ejemplo `1.2.0`) y despliega.
3. Si la API no responde, la app sigue funcionando: la versión mínima nunca bloquea por error de red.

Sin las variables, el valor es `0.0.0` y no se bloquea a nadie.
