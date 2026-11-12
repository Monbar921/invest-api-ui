import { type AnalyticsConsent, CONSENT_STORAGE_KEY, resetAnalytics } from '../lib/analytics';

export const COUNTER_ID = 12345;

/**
 * Включает аналитику как в сборке со счётчиком: номер счётчика, выбор посетителя (по умолчанию согласие) и подменённый
 * window.ym - вызовы счётчика складываются в него, настоящий tag.js не грузится. Сбрасывает всё setup.ts после теста.
 */
export function enableAnalytics({ consent = 'accepted' }: { consent?: AnalyticsConsent | null } = {}) {
  vi.stubEnv('VITE_YANDEX_METRIKA_ID', String(COUNTER_ID));
  resetAnalytics();
  if (consent) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consent);
  }
  const ym = vi.fn();
  window.ym = ym;
  return ym;
}

/** Отправленные цели: [цель, параметры] */
export function sentGoals(ym: ReturnType<typeof vi.fn>) {
  return ym.mock.calls.filter((call) => call[1] === 'reachGoal').map((call) => [call[2], call[3]]);
}

/** Отправленные просмотры: [адрес, параметры] */
export function sentHits(ym: ReturnType<typeof vi.fn>) {
  return ym.mock.calls.filter((call) => call[1] === 'hit').map((call) => [call[2], call[3]]);
}
