import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GUEST } from '../api/session';
import type { Bond, Page } from '../api/types';
import { enableAnalytics, sentGoals } from '../test/analytics';
import { mockFetch, renderRoute } from '../test/render';
import { BondPage } from './BondPage';
import { BondsPage } from './BondsPage';

const rated = (ticker: string, overrides: Partial<Bond> = {}): Bond => ({
  ticker,
  uid: `uid-${ticker}`,
  isin: ticker,
  name: `Облигация ${ticker}`,
  sector: 'financial',
  price: {
    uid: null,
    nominal: { quantity: 1000, currency: 'rub' },
    current: { quantity: 950, currency: 'rub' },
    currentInRub: 950,
    percentagePrice: 95,
    aci: { quantity: 11.72, currency: 'rub' },
  },
  coupon: {
    uid: null,
    quantityPerYear: 4,
    interest: 12.5,
    isFixed: false,
    yieldToMaturity: 18.4,
    yieldToOffer: null,
    durationMacaulay: 2.35,
    durationModified: 1.99,
    couponData: null,
  },
  riskLevel: 'RISK_LEVEL_LOW',
  maturityDate: '2029-01-01T00:00:00Z',
  offerDate: null,
  amortizationFlag: false,
  creditRating: {
    agency: 'NKR',
    scope: 'ISSUER',
    rating: 'A.ru',
    grade: 'A',
    score: 15,
    outlook: 'NEGATIVE',
    actionDate: '2026-11-13',
    url: 'https://ratings.ru/ratings/press-releases/AFB-2/',
  },
  liquidity: {
    avgDailyVolume: 1234.5,
    avgDailyTurnover: { quantity: 1_250_000, currency: 'rub' },
    avgDailyTurnoverRub: 1_250_000,
    tradingDays: 21,
    periodDays: 30,
  },
  ofzCurveYield: 14.2,
  spreadToOfz: 4.2,
  floaterBaseRate: 'Ключевая ставка',
  floaterPremium: null,
  ...overrides,
});

const page = (content: Bond[]): Page<Bond> => ({ content, page: 0, size: 50, totalElements: content.length, totalPages: 1 });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Скринер: список облигаций', () => {
  it('показывает рейтинг, дюрацию, спред к ОФЗ и оборот; без данных - прочерк', async () => {
    mockFetch({
      body: page([rated('RU000A1'), rated('RU000A2', { creditRating: null, liquidity: null, spreadToOfz: null, coupon: null })]),
    });

    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds' });
    const row = (await screen.findByText('RU000A1')).closest('tr')!;

    expect(within(row).getByText('A')).toBeInTheDocument();
    expect(within(row).getByText('НКР')).toBeInTheDocument();
    expect(within(row).getByText('2,35')).toBeInTheDocument();
    expect(within(row).getByText('+4,2 п.п.')).toBeInTheDocument();
    expect(within(row).getByText((text) => text.replace(/\s/g, ' ') === '1,3 млн ₽')).toBeInTheDocument();
    const empty = screen.getByText('RU000A2').closest('tr')!;
    expect(within(empty).getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    ['Рейтинг', 'CREDIT_RATING'],
    ['Дюрация,', 'DURATION'],
    ['Спред', 'SPREAD_TO_OFZ'],
    ['Оборот', 'AVG_DAILY_TURNOVER'],
  ])('сортировка по колонке «%s»', async (title, sortField) => {
    const calls = mockFetch({ body: page([rated('RU000A1')]) });
    const { router } = renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds' });
    await screen.findByText('RU000A1');

    // заголовки в две строки через <br> - ищем колонку по началу текста
    const header = [...document.querySelectorAll('th')].find((th) => th.textContent?.trim().startsWith(title))!;
    await userEvent.click(header);

    await waitFor(() => expect(router.state.location.search).toBe(`?sort=${sortField}%3AASC`));
    await waitFor(() =>
      expect(JSON.parse(String(calls.at(-1)!.init?.body)).bondSorts).toEqual([{ sortField, sortOrder: 'ASC' }]),
    );
  });

  it('«Ещё фильтры»: оферта и оборот попадают в URL и в запрос', async () => {
    const ym = enableAnalytics();
    const calls = mockFetch({ body: page([rated('RU000A1')]) });
    const { router } = renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds' });
    await screen.findByText('RU000A1');

    await userEvent.click(screen.getByRole('button', { name: 'Ещё фильтры' }));
    // у оферты и амортизации одинаковые варианты - первая группа - оферта
    await userEvent.click(screen.getAllByText('Нет')[0]!);
    await waitFor(() => expect(router.state.location.search).toBe('?offer=without'));
    await userEvent.type(screen.getByLabelText('Оборот в день, ₽: от'), '1000000');

    await waitFor(() => expect(router.state.location.search).toBe('?offer=without&turnoverMin=1000000'));
    await waitFor(() => {
      const body = JSON.parse(String(calls.at(-1)!.init?.body));
      expect(body.hasOffer).toBe(false);
      expect(body.avgDailyTurnover).toEqual({ min: 1000000 });
    });
    expect(sentGoals(ym)).toEqual([
      ['bond_filter', { filter: ['offer'] }],
      ['bond_filter', { filter: ['turnoverMin'] }],
    ]);
  });

  it('по ссылке с фильтром скринера панель открыта, «Сбросить» снимает и его', async () => {
    const calls = mockFetch({ body: page([rated('RU000A1')]) });
    const { router } = renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds?ratingMin=BBB-&sector=financial' });
    await screen.findByText('RU000A1');

    expect(screen.getByRole('button', { name: 'Ещё фильтры' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByDisplayValue('не ниже BBB-')).toBeInTheDocument();
    expect(JSON.parse(String(calls[0]!.init?.body))).toMatchObject({
      creditRating: { min: 'BBB-' },
      sectors: ['financial'],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Сбросить' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('гость вместо выгрузки видит вход', async () => {
    mockFetch({ body: page([rated('RU000A1')]) });
    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds', session: GUEST });
    await screen.findByText('RU000A1');

    expect(screen.getByRole('button', { name: 'Войти, чтобы выгрузить' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Выгрузить' })).not.toBeInTheDocument();
  });

  it('выгружает всю выборку с теми же фильтрами файлом', async () => {
    const ym = enableAnalytics();
    // остальные запросы страницы (лента, тариф, колокольчики) - как в mockFetch, выгрузка - файлом
    mockFetch({ body: page([rated('RU000A1')]) });
    const pageFetch = globalThis.fetch;
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (!url.includes('/export')) {
        return pageFetch(url, init);
      }
      requests.push({ url, init });
      return new Response('csv', {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="bonds-local-2026-11-14.csv"' },
      });
    });
    const createObjectURL = vi.fn(() => 'blob:bonds');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds?scope=local&coupon=fixed&sort=DURATION:DESC' });
    await screen.findByText('RU000A1');
    await userEvent.click(screen.getByRole('button', { name: 'Выгрузить' }));
    await userEvent.click(await screen.findByText('CSV (.csv)'));

    await waitFor(() => expect(click).toHaveBeenCalled());
    const exportRequest = requests.find((request) => request.url.includes('/export'))!;
    expect(exportRequest.url).toBe('/api/bonds/local/export?format=CSV');
    expect(exportRequest.init?.method).toBe('POST');
    expect(JSON.parse(String(exportRequest.init?.body))).toEqual({
      bondSorts: [{ sortField: 'DURATION', sortOrder: 'DESC' }],
      isFixedCoupon: true,
    });
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('bonds-local-2026-11-14.csv');
    expect(sentGoals(ym)).toEqual([['bond_export', { format: 'CSV' }]]);
  });
});

describe('Скринер: карточка облигации', () => {
  it('показывает рейтинги агентств, дюрацию, спред, оборот и базу флоатера', async () => {
    mockFetch(
      {
        body: rated('RU000A10EQ34', {
          creditRatings: [
            {
              agency: 'ACRA',
              scope: 'ISSUE',
              rating: 'A+(RU)',
              grade: 'A+',
              score: 16,
              outlook: null,
              actionDate: '2026-10-01',
              url: null,
            },
            rated('X').creditRating!,
          ],
        }),
      },
      { body: [] },
    );

    renderRoute(<BondPage />, { path: '/bonds/:ticker', url: '/bonds/RU000A10EQ34' });

    expect(await screen.findByText('Кредитный рейтинг')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'АКРА: A+(RU) (выпуска) · 01.10.2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'A.ru' })).toHaveAttribute(
      'href',
      'https://ratings.ru/ratings/press-releases/AFB-2/',
    );
    expect(screen.getByText('2,35 г.')).toBeInTheDocument();
    expect(screen.getByText('модифицированная 1,99: цена −1,99 % при росте доходности на 1 п.п.')).toBeInTheDocument();
    expect(screen.getByText('+4,2 п.п.')).toBeInTheDocument();
    expect(screen.getByText('ОФЗ на срок дюрации - 14,2 %')).toBeInTheDocument();
    expect(screen.getByText((text) => text.replace(/\s/g, ' ') === '≈ 1 234,5 шт. · средний за 30 дней')).toBeInTheDocument();
    expect(screen.getByText('переменный, Ключевая ставка · 4 выплаты в год')).toBeInTheDocument();
  });

  it('без рейтинга и свечей - поясняет, почему пусто', async () => {
    mockFetch(
      {
        body: rated('RU000A2', {
          creditRating: null,
          creditRatings: [],
          liquidity: null,
          ofzCurveYield: null,
          spreadToOfz: null,
        }),
      },
      { body: [] },
    );

    renderRoute(<BondPage />, { path: '/bonds/:ticker', url: '/bonds/RU000A2' });

    expect(await screen.findByText('нет рейтинга АКРА и НКР')).toBeInTheDocument();
    expect(screen.getByText('свечей по облигации нет')).toBeInTheDocument();
    expect(screen.getByText('только рублёвые облигации с доходностью к погашению')).toBeInTheDocument();
  });
});
