import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GUEST } from '../api/session';
import { AppLayout } from '../layout/AppLayout';
import { enableAnalytics, sentGoals, sentHits } from '../test/analytics';
import { mockFetchByUrl, renderRoute, USER } from '../test/render';
import { HomePage } from './HomePage';

const COLLECTION = {
  slug: 'top-ofz',
  title: 'Самые доходные ОФЗ',
  description: 'ОФЗ с наибольшей доходностью к погашению.',
};

const bond = (ticker: string, name: string, ytm: number) => ({
  ticker,
  uid: ticker,
  isin: ticker,
  name,
  sector: 'government',
  price: { uid: null, nominal: null, current: null, currentInRub: null, percentagePrice: 64.5, aci: null },
  coupon: {
    uid: null,
    quantityPerYear: 2,
    interest: 7,
    isFixed: true,
    yieldToMaturity: ytm,
    yieldToOffer: null,
    couponData: null,
  },
  riskLevel: 'RISK_LEVEL_LOW',
  maturityDate: '2039-05-10T00:00:00Z',
  offerDate: null,
  amortizationFlag: false,
});

const collectionPage = {
  ...COLLECTION,
  bonds: {
    content: [bond('SU26240RMFS0', 'ОФЗ 26240', 15.42)],
    page: 0,
    size: 5,
    totalElements: 1,
    totalPages: 1,
  },
};

const withCollection: [RegExp, unknown][] = [
  [/\/api\/bonds\/collections$/, [COLLECTION]],
  [/\/api\/bonds\/collections\/top-ofz\?/, collectionPage],
];

const featureCard = (title: string) => screen.getByText(title).closest('.mantine-Card-root') as HTMLElement;

const renderHome = (session = GUEST) => renderRoute(<HomePage />, { path: '/', url: '/', session });

afterEach(() => vi.unstubAllGlobals());

describe('лендинг', () => {
  it('гость на «/» видит, что умеет продукт, вход и ссылку на облигации', async () => {
    mockFetchByUrl([]);
    renderHome();

    expect(screen.getByRole('heading', { level: 1, name: /Облигации Мосбиржи/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти / Зарегистрироваться' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Смотреть облигации' })).toHaveAttribute('href', '/bonds');
    expect(screen.getByText('Калькулятор дохода')).toBeInTheDocument();
    // портфель и уведомления - личные: ссылки нет, есть пометка
    const portfolio = featureCard('Портфель');
    expect(within(portfolio).getByText('после входа')).toBeInTheDocument();
    expect(within(portfolio).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/не даёт инвестиционных рекомендаций/)).toBeInTheDocument();
  });

  it('вошедшего «/» сразу ведёт на список облигаций', async () => {
    mockFetchByUrl([]);
    const { router } = renderHome(USER);

    await waitFor(() => expect(router.state.location.pathname).toBe('/bonds'));
    expect(screen.queryByRole('button', { name: 'Войти / Зарегистрироваться' })).not.toBeInTheDocument();
  });

  it('показывает облигации первой подборки на настоящих данных', async () => {
    const calls = mockFetchByUrl(withCollection);
    renderHome();

    expect(await screen.findByRole('heading', { name: 'Самые доходные ОФЗ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ОФЗ 26240' })).toHaveAttribute('href', '/bonds/SU26240RMFS0');
    expect(screen.getByText('15,42 %')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Вся подборка' })).toHaveAttribute('href', '/collections/top-ofz');
    expect(calls).toContain('/api/bonds/collections/top-ofz?page=0&size=5');
    // «Карточка облигации» ведёт на настоящую карточку - первую облигацию подборки, а не в список
    expect(within(featureCard('Карточка облигации')).getByRole('link', { name: 'Открыть' })).toHaveAttribute(
      'href',
      '/bonds/SU26240RMFS0',
    );
  });

  it('без подборок или при ошибке бэка - лендинг без блока данных', async () => {
    const calls = mockFetchByUrl([[/\/api\/bonds\/collections$/, { title: 'Internal Server Error' }]]);
    renderHome();

    await waitFor(() => expect(calls).toContain('/api/bonds/collections'));
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // облигации для примера нет - карточка ведёт в список
    expect(within(featureCard('Карточка облигации')).getByRole('link', { name: 'Открыть' })).toHaveAttribute('href', '/bonds');
  });

  it('метаданные: canonical «/», title - название сайта', () => {
    mockFetchByUrl([]);
    renderHome();

    expect(document.title).toBe('Облигации');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `${window.location.origin}/`);
  });

  it('вход с лендинга - цель в аналитику и переход на Keycloak с возвратом на «/»', async () => {
    const ym = enableAnalytics();
    mockFetchByUrl([]);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, origin: window.location.origin, pathname: '/', search: '', assign });
    renderHome();

    await userEvent.click(screen.getByRole('button', { name: 'Войти / Зарегистрироваться' }));

    expect(sentGoals(ym)).toEqual([['landing_login', undefined]]);
    expect(assign).toHaveBeenCalledWith('/oauth2/authorization/keycloak?returnTo=%2F');
  });
});

describe('аналитика в шапке', () => {
  it('без счётчика в сборке баннера согласия нет', () => {
    mockFetchByUrl([]);
    renderRoute(<AppLayout />, { path: '/bonds', url: '/bonds', session: GUEST });

    expect(screen.queryByRole('region', { name: 'Согласие на cookie' })).not.toBeInTheDocument();
  });

  it('спрашивает согласие и после «Принять» отправляет просмотр текущей страницы', async () => {
    const ym = enableAnalytics({ consent: null });
    mockFetchByUrl([]);
    renderRoute(<AppLayout />, { path: '/bonds', url: '/bonds', session: GUEST });

    const banner = screen.getByRole('region', { name: 'Согласие на cookie' });
    expect(within(banner).getByText(/Яндекс Метрику/)).toBeInTheDocument();
    expect(ym).not.toHaveBeenCalled();

    await userEvent.click(within(banner).getByRole('button', { name: 'Принять' }));

    expect(screen.queryByRole('region', { name: 'Согласие на cookie' })).not.toBeInTheDocument();
    expect(sentHits(ym)).toEqual([[`${window.location.origin}/bonds`, {}]]);
  });

  it('после «Отказаться» баннер уходит и ничего не отправляется', async () => {
    const ym = enableAnalytics({ consent: null });
    mockFetchByUrl([]);
    renderRoute(<AppLayout />, { path: '/bonds', url: '/bonds', session: GUEST });

    await userEvent.click(screen.getByRole('button', { name: 'Отказаться' }));

    expect(screen.queryByRole('region', { name: 'Согласие на cookie' })).not.toBeInTheDocument();
    expect(ym).not.toHaveBeenCalled();
  });

  it('с согласием считает каждый переход; вошедший на «/» лендинг не видит - его не считаем', async () => {
    const ym = enableAnalytics();
    mockFetchByUrl([]);
    const { router } = renderRoute(<AppLayout />, { path: '*', url: '/', session: USER });

    await router.navigate('/bonds?coupon=fixed');

    await waitFor(() => expect(sentHits(ym)).toEqual([[`${window.location.origin}/bonds?coupon=fixed`, {}]]));
  });
});
