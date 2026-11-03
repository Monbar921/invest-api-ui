# Запуск и деплой invest-api-ui

## Dev-сервер

Нужен Node 24 и запущенные [invest-gateway](../../invest-gateway/docs/deployment.md) (вместе с Keycloak) и invest-api.

```bash
npm install
npm run dev
```

UI открывается на http://localhost:5173. Vite проксирует `/api`, `/oauth2`, `/login`, `/logout` на gateway
(`http://127.0.0.1:8082`, другой адрес - через переменную окружения `GATEWAY_URL`). Proxy не меняет Host и добавляет
`X-Forwarded-*`, поэтому gateway строит redirect URI для Keycloak от адреса UI.

Dev-сервер слушает IPv4 `127.0.0.1`: на некоторых машинах подключения к IPv6-loopback `[::1]` закрыты.
Порт 5173 жёсткий (`strictPort`) - он прописан в redirect URI клиента в Keycloak. Другой адрес или порт UI нужно
добавить в redirect URIs клиента `invest-gateway`.

## Сборка

```bash
npm run build     # tsc -b && vite build → dist/
npm run preview   # раздача dist/
```

`VITE_API_URL` (см. `.env.example`) задаётся только если API на другом origin; по умолчанию пути относительные.

## Стенд в k3d

[invest-deploy](../../invest-deploy/docs/deployment.md): `.\deploy.ps1 ui` собирает `dist/` и кладёт его в образ
nginx (`invest-deploy/docker/ui.Dockerfile`, SPA-fallback на `index.html`). Ingress отдаёт `/api`, `/oauth2`, `/login`,
`/logout` в gateway, остальное - в UI. Адрес: http://invest.localhost:8088.
