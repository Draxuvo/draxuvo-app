# draxuvo-app

App operativa de **Draxuvo**: el personal operativo operará desde aquí su día a día. Parte del [workspace Draxuvo](https://github.com/bothi3119/bothi).

## Estado

En construcción. Todavía no hay código ni se ha definido el stack. Mientras tanto, el personal usa las pantallas de staff del panel ([draxuvo-ui](https://github.com/Draxuvo/draxuvo-ui)): `/mis-ordenes`, `/mis-tickets` y `/mi-perfil`.

## Ecosistema

| Repositorio | Descripción |
|---|---|
| [draxuvo-api](https://github.com/Draxuvo/draxuvo-api) | API REST (Rails 8, PostgreSQL), ERP multiempresa |
| [draxuvo-ui](https://github.com/Draxuvo/draxuvo-ui) | Panel del ERP (Next.js 16) |
| [draxuvo-web](https://github.com/Draxuvo/draxuvo-web) | Sitio público (Next.js 16) |
| **draxuvo-app** | Este repositorio |

Su alcance se definirá con una spec en el workspace. Lo previsto es que use la misma API (`/api/v1`, JWT y `X-Company-Id`).
