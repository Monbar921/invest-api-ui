/// <reference types="vitest/config" />
import dns from 'node:dns';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Node отдаёт для localhost сначала IPv6 (::1), и Vite слушал бы только [::1]. Подключения к IPv6-loopback
// бывают закрыты фаерволом - тогда страница не открывается. С ipv4first сервер слушает 127.0.0.1;
// открывать можно и http://localhost:5173, и http://127.0.0.1:5173 - оба origin разрешены в CORS на бэке
dns.setDefaultResultOrder('ipv4first');

export default defineConfig({
  plugins: [react()],
  server: {
    // порт совпадает с ru.invest.api.cors.allowed-origins на бэке
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
  },
});
