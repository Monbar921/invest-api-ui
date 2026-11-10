import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import 'mantine-datatable/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { parseSession } from './api/session';

declare global {
  interface Window {
    /** Ответ GET /api/session из index.html; null - не удалось узнать (рисуем для гостя) */
    investSession?: Promise<unknown>;
  }
}

void (window.investSession ?? Promise.resolve(null))
  .catch(() => null)
  .then((body) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App session={parseSession(body)} />
      </StrictMode>,
    );
  });
