// UI ходит в invest-gateway с того же origin (в dev - через proxy Vite), поэтому по умолчанию пути относительные:
// session cookie и XSRF-TOKEN gateway работают только для same-origin запросов
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Старт OAuth2-логина на gateway: он перекинет на Keycloak и после входа вернёт на страницу из returnTo */
export const LOGIN_PATH = '/oauth2/authorization/keycloak';

/** Адрес входа с возвратом на текущую страницу (путь и query; gateway принимает только пути своего origin) */
export function loginUrl(returnTo = `${window.location.pathname}${window.location.search}`): string {
  return `${API_URL}${LOGIN_PATH}?${new URLSearchParams({ returnTo })}`;
}

/** Вход: уходим на Keycloak, после входа gateway вернёт на эту же страницу */
export function login(): void {
  window.location.assign(loginUrl());
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Ошибка ответа API. Бэк отдаёт ошибки в формате ProblemDetail (RFC 9457). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ProblemDetail {
  title?: string;
  detail?: string;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...csrfHeader(init?.method), ...init?.headers },
    });
  } catch {
    throw new ApiError(0, `Сервер недоступен: ${API_URL || window.location.origin}`);
  }

  if (response.status === 401) {
    // личные данные запрашиваются только с сессией (useSession), значит она истекла - входим заново и возвращаемся сюда
    login();
    throw new ApiError(401, 'Требуется вход');
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  // 204 No Content (DELETE): тела нет
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as ProblemDetail;
    return problem.detail ?? problem.title ?? `Ошибка ${response.status}`;
  } catch {
    return `Ошибка ${response.status}`;
  }
}

/** Выход: gateway завершает сессию и отдаёт в Location адрес выхода из Keycloak, туда и переходим */
export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/logout`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeader('POST'),
  });
  window.location.assign(response.headers.get('Location') ?? '/');
}

/** Значение cookie XSRF-TOKEN, которую ставит gateway. Нужно для POST-запросов и формы выхода */
export function readCsrfToken(): string | undefined {
  const cookie = document.cookie.split('; ').find((part) => part.startsWith('XSRF-TOKEN='));
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : undefined;
}

function csrfHeader(method = 'GET'): Record<string, string> {
  const token = SAFE_METHODS.has(method.toUpperCase()) ? undefined : readCsrfToken();
  return token ? { 'X-XSRF-TOKEN': token } : {};
}
