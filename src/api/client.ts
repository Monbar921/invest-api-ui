// UI ходит в invest-gateway с того же origin (в dev - через proxy Vite), поэтому по умолчанию пути относительные:
// session cookie и XSRF-TOKEN gateway работают только для same-origin запросов
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Абсолютный адрес пути API - для ссылок, которые открывают не из UI (подписка календаря) */
export function absoluteApiUrl(path: string): string {
  return new URL(`${API_URL}${path}`, window.location.origin).toString();
}

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
  /** Тело ошибки: у 402 - тариф, исчерпанный лимит или закрытая фича */
  readonly problem: ProblemDetail;

  constructor(status: number, message: string, problem: ProblemDetail = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }
}

export interface ProblemDetail {
  title?: string;
  detail?: string;
  /** 402: id тарифа пользователя */
  plan?: string;
  /** 402: исчерпанный лимит и его значение */
  limit?: string;
  max?: number;
  /** 402: фича, которой нет в тарифе */
  feature?: string;
}

/** Действие не входит в тариф (402): лимит исчерпан или фича закрыта - UI предлагает посмотреть тарифы */
export function isPlanRestriction(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 402;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: {
        // FormData (файл отчёта): Content-Type с границей частей ставит браузер
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        ...csrfHeader(init?.method),
        ...init?.headers,
      },
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
    const problem = await readProblem(response);
    throw new ApiError(response.status, problem.detail ?? problem.title ?? `Ошибка ${response.status}`, problem);
  }

  // 204 No Content (DELETE): тела нет
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Файл с API: тело и имя из Content-Disposition (без него - fallbackName) */
export async function download(path: string, init: RequestInit, fallbackName: string): Promise<{ blob: Blob; fileName: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...csrfHeader(init.method), ...init.headers },
    });
  } catch {
    throw new ApiError(0, `Сервер недоступен: ${API_URL || window.location.origin}`);
  }
  if (response.status === 401) {
    login();
    throw new ApiError(401, 'Требуется вход');
  }
  if (!response.ok) {
    const problem = await readProblem(response);
    throw new ApiError(response.status, problem.detail ?? problem.title ?? `Ошибка ${response.status}`, problem);
  }
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const fileName = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
  return { blob: await response.blob(), fileName };
}

async function readProblem(response: Response): Promise<ProblemDetail> {
  try {
    return ((await response.json()) as ProblemDetail | null) ?? {};
  } catch {
    return {};
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
