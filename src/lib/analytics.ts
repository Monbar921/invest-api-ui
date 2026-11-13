/**
 * Продуктовая аналитика: просмотры страниц и ключевые действия. Сервис - Яндекс Метрика, но остальной код знает только
 * функции этого модуля: смена сервиса (например, на self-hosted) меняет один этот файл.
 *
 * Правила:
 * - номер счётчика не задан (`VITE_YANDEX_METRIKA_ID`) - модуль ничего не делает, баннера согласия нет;
 * - Метрика ставит cookie, поэтому скрипт грузится только после согласия посетителя; до согласия и после отказа события
 *   отбрасываются, а не копятся;
 * - персональные данные не передаются: ни имени пользователя, ни id, ни содержимого форм (Вебвизор и карта кликов
 *   выключены); у целей - только тип действия, без тикеров личных покупок и правил.
 */

/** Ключевые действия - цели счётчика; в Метрике цели заводятся с этими идентификаторами (тип «JavaScript-событие») */
export type AnalyticsGoal =
  /** изменён фильтр списка облигаций */
  | 'bond_filter'
  /** калькулятор посчитал доход (раз на открытую облигацию) */
  | 'profit_calculation'
  /** в портфель добавлена покупка */
  | 'portfolio_position_added'
  /** в портфель добавлена продажа */
  | 'portfolio_sale_added'
  /** создана личная ссылка на календарь выплат (.ics) */
  | 'portfolio_calendar_link_created'
  /** создано правило уведомлений */
  | 'alert_rule_created'
  /** Telegram подключён - бот подтвердил привязку */
  | 'telegram_connected'
  /** «Войти / Зарегистрироваться» на лендинге */
  | 'landing_login'
  /** переход к оплате тарифа (страница Т-Кассы) */
  | 'plan_checkout_started'
  /** оплата тарифа подтверждена после возврата с оплаты */
  | 'plan_paid';

/** Параметры цели: только перечислимые значения, без персональных данных */
export type GoalParams = Record<string, string | string[]>;

export type AnalyticsConsent = 'accepted' | 'declined';

/** Выбор посетителя в баннере; хранится в браузере, чтобы не спрашивать снова */
export const CONSENT_STORAGE_KEY = 'invest.analytics-consent';

const METRIKA_SCRIPT_URL = 'https://mc.yandex.ru/metrika/tag.js';

type Ym = ((counterId: number, method: string, ...args: unknown[]) => void) & { a?: unknown[]; l?: number };

declare global {
  interface Window {
    ym?: Ym;
  }
}

let started = false;
/** Текущая страница: после согласия её просмотр отправляется сразу, иначе первая страница визита потерялась бы */
let currentUrl: string | null = null;
let previousUrl: string | null = null;
/** Выбор на эту страницу - на случай, если localStorage недоступен */
let sessionConsent: AnalyticsConsent | null = null;

/** Номер счётчика Метрики из сборки; не задан или не число - аналитика выключена */
export function metrikaCounterId(): number | null {
  const raw = import.meta.env.VITE_YANDEX_METRIKA_ID as string | undefined;
  const id = Number(raw);
  return raw && Number.isInteger(id) && id > 0 ? id : null;
}

export function analyticsEnabled(): boolean {
  return metrikaCounterId() != null;
}

/** Выбор посетителя; null - ещё не выбирал. Хранилище недоступно (приватный режим) - как будто не выбирал */
export function readConsent(): AnalyticsConsent | null {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'accepted' || value === 'declined' ? value : null;
  } catch {
    return null;
  }
}

/** Сохраняет выбор; согласие сразу запускает счётчик и отправляет просмотр текущей страницы */
export function saveConsent(consent: AnalyticsConsent): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  } catch {
    // не сохранилось - баннер спросит снова при следующем открытии, на этой странице выбор всё равно действует
  }
  sessionConsent = consent;
  if (consent === 'accepted' && start() && currentUrl) {
    hit(currentUrl);
  }
}

function consentGiven(): boolean {
  return (readConsent() ?? sessionConsent) === 'accepted';
}

/** Просмотр страницы SPA: путь с query. Без счётчика или согласия - только запоминается */
export function trackPageView(path: string): void {
  const url = new URL(path, window.location.origin).href;
  if (url === currentUrl) {
    return;
  }
  previousUrl = currentUrl;
  currentUrl = url;
  if (start()) {
    hit(url);
  }
}

/** Ключевое действие */
export function trackGoal(goal: AnalyticsGoal, params?: GoalParams): void {
  const id = metrikaCounterId();
  if (id != null && start()) {
    window.ym!(id, 'reachGoal', goal, params);
  }
}

function hit(url: string) {
  // referer - прошлая страница SPA: иначе Метрика считала бы каждый переход заходом извне
  window.ym!(metrikaCounterId()!, 'hit', url, previousUrl ? { referer: previousUrl } : {});
}

/** Подключает счётчик один раз - когда он задан и посетитель согласился; true - счётчик работает */
function start(): boolean {
  if (started) {
    return true;
  }
  const id = metrikaCounterId();
  if (id == null || !consentGiven()) {
    return false;
  }

  // очередь вызовов до загрузки tag.js - так же, как в стандартном коде счётчика
  if (!window.ym) {
    const queue: Ym = (...args: unknown[]) => {
      (queue.a = queue.a ?? []).push(args);
    };
    queue.l = Date.now();
    window.ym = queue;
  }
  const script = document.createElement('script');
  script.async = true;
  script.src = METRIKA_SCRIPT_URL;
  document.head.appendChild(script);

  window.ym(id, 'init', {
    // просмотры отправляет trackPageView при каждой смене маршрута, автоматический первый просмотр не нужен
    defer: true,
    trackLinks: true,
    accurateTrackBounce: true,
    // без записи сессий и карты кликов: они захватывали бы введённое в формы (суммы покупок, пороги уведомлений)
    webvisor: false,
    clickmap: false,
  });
  started = true;
  return true;
}

/** Для тестов: модуль хранит состояние между вызовами */
export function resetAnalytics(): void {
  started = false;
  currentUrl = null;
  previousUrl = null;
  sessionConsent = null;
}
