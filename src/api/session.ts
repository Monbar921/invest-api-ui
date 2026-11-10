import { createContext, useContext } from 'react';

/** Состояние входа: GET /api/session отвечает сам gateway, всегда 200 */
export interface Session {
  authenticated: boolean;
  /** preferred_username из Keycloak; у гостя - null */
  username: string | null;
}

export const GUEST: Session = { authenticated: false, username: null };

export const SESSION_PATH = '/api/session';

/**
 * Состояние входа на всё время жизни страницы: вход и выход - переходы на другую страницу, после них приложение
 * загружается заново. Значение по умолчанию - гость: без провайдера ничего личного не запрашивается.
 */
export const SessionContext = createContext<Session>(GUEST);

export function useSession(): Session {
  return useContext(SessionContext);
}

/** Ответ /api/session; что-то другое (gateway недоступен, старый gateway без эндпоинта) - гость */
export function parseSession(body: unknown): Session {
  if (typeof body === 'object' && body != null && (body as Session).authenticated === true) {
    const username = (body as Session).username;
    return { authenticated: true, username: typeof username === 'string' ? username : null };
  }
  return GUEST;
}
