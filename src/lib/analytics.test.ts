import { COUNTER_ID, enableAnalytics, sentGoals, sentHits } from '../test/analytics';
import {
  analyticsEnabled,
  CONSENT_STORAGE_KEY,
  metrikaCounterId,
  readConsent,
  saveConsent,
  trackGoal,
  trackPageView,
} from './analytics';

const metrikaScripts = () => document.head.querySelectorAll('script[src="https://mc.yandex.ru/metrika/tag.js"]');
const url = (path: string) => new URL(path, window.location.origin).href;

afterEach(() => vi.restoreAllMocks());

describe('аналитика', () => {
  it('без номера счётчика выключена: ничего не грузит и не отправляет', () => {
    const ym = vi.fn();
    window.ym = ym;
    window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');

    trackPageView('/bonds');
    trackGoal('bond_filter', { filter: ['ofz'] });

    expect(analyticsEnabled()).toBe(false);
    expect(ym).not.toHaveBeenCalled();
    expect(metrikaScripts()).toHaveLength(0);
  });

  it('номер счётчика - только целое положительное число', () => {
    vi.stubEnv('VITE_YANDEX_METRIKA_ID', 'abc');
    expect(metrikaCounterId()).toBeNull();
    vi.stubEnv('VITE_YANDEX_METRIKA_ID', '0');
    expect(metrikaCounterId()).toBeNull();
    vi.stubEnv('VITE_YANDEX_METRIKA_ID', String(COUNTER_ID));
    expect(metrikaCounterId()).toBe(COUNTER_ID);
  });

  it('до согласия счётчик не грузится и события отбрасываются', () => {
    const ym = enableAnalytics({ consent: null });

    trackPageView('/bonds');
    trackGoal('profit_calculation');

    expect(ym).not.toHaveBeenCalled();
    expect(metrikaScripts()).toHaveLength(0);
  });

  it('после отказа - тоже ничего', () => {
    const ym = enableAnalytics({ consent: null });
    saveConsent('declined');

    trackPageView('/bonds');
    trackGoal('profit_calculation');

    expect(readConsent()).toBe('declined');
    expect(ym).not.toHaveBeenCalled();
    expect(metrikaScripts()).toHaveLength(0);
  });

  it('согласие запускает счётчик без Вебвизора и отправляет просмотр текущей страницы', () => {
    const ym = enableAnalytics({ consent: null });
    trackPageView('/');

    saveConsent('accepted');

    expect(readConsent()).toBe('accepted');
    expect(metrikaScripts()).toHaveLength(1);
    expect(ym).toHaveBeenCalledWith(COUNTER_ID, 'init', {
      defer: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: false,
      clickmap: false,
    });
    // события до согласия не копились: только просмотр страницы, на которой согласились
    expect(sentHits(ym)).toEqual([[url('/'), {}]]);
  });

  it('просмотры страниц SPA - с прошлой страницей в referer, повтор того же адреса не считается', () => {
    const ym = enableAnalytics();

    trackPageView('/bonds');
    trackPageView('/bonds');
    trackPageView('/bonds?coupon=floating');

    expect(sentHits(ym)).toEqual([
      [url('/bonds'), {}],
      [url('/bonds?coupon=floating'), { referer: url('/bonds') }],
    ]);
    // скрипт подключается один раз
    expect(metrikaScripts()).toHaveLength(1);
  });

  it('цели - с параметрами, как переданы', () => {
    const ym = enableAnalytics();

    trackGoal('alert_rule_created', { type: 'PRICE_LEVEL' });
    trackGoal('landing_login');

    expect(sentGoals(ym)).toEqual([
      ['alert_rule_created', { type: 'PRICE_LEVEL' }],
      ['landing_login', undefined],
    ]);
  });

  it('без window.ym ставит очередь вызовов до загрузки tag.js', () => {
    enableAnalytics();
    delete window.ym;

    trackGoal('landing_login');

    // после delete TypeScript считает window.ym навсегда undefined - читаем заново через тип Window
    const queue = (window as Window).ym;
    expect(queue?.a?.map((args) => (args as unknown[])[1])).toEqual(['init', 'reachGoal']);
  });

  it('недоступное хранилище (приватный режим): выбор действует на эту страницу', () => {
    const ym = enableAnalytics({ consent: null });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(readConsent()).toBeNull();
    saveConsent('accepted');
    trackGoal('landing_login');

    expect(sentGoals(ym)).toEqual([['landing_login', undefined]]);
  });
});
