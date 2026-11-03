/// <reference types="vitest/config" />
import dns from 'node:dns';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Node отдаёт для localhost сначала IPv6 (::1), и Vite слушал бы только [::1]. Подключения к IPv6-loopback
// бывают закрыты фаерволом - тогда страница не открывается. С ipv4first сервер слушает 127.0.0.1;
// открывать можно и http://localhost:5173, и http://127.0.0.1:5173 - оба origin разрешены в CORS на бэке
dns.setDefaultResultOrder('ipv4first');

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://127.0.0.1:8082';

export default defineConfig({
  plugins: [react()],
  server: {
    // порт совпадает с redirect URI клиента invest-gateway в Keycloak
    port: 5173,
    strictPort: true,
    // всё, что не UI, уходит в invest-gateway. Host не подменяется (changeOrigin: false), а xfwd добавляет
    // X-Forwarded-*: gateway строит redirect_uri для Keycloak от адреса UI, и cookie остаются на origin UI
    proxy: Object.fromEntries(
      ['/api', '/oauth2', '/login', '/logout'].map((path) => [path, { target: GATEWAY_URL, xfwd: true }]),
    ),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
});
