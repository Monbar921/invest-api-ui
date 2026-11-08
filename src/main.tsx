import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import 'mantine-datatable/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

declare global {
  interface Window {
    /** Проверка сессии из index.html: false - уже уходим на логин, приложение не рисуем */
    investSessionCheck?: Promise<boolean>;
  }
}

void (window.investSessionCheck ?? Promise.resolve(true)).then((authorized) => {
  if (!authorized) {
    return;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
