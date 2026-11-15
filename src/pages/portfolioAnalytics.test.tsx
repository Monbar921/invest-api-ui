import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Portfolio, PortfolioAnalytics, PortfolioAnalyticsShare } from '../api/types';
import { renderRoute } from '../test/render';
import { PortfolioPage } from './PortfolioPage';

const share = (key: string | null, valueInRub: number, value: number, overrides: Partial<PortfolioAnalyticsShare> = {}) =>
  ({ key, title: null, valueInRub, share: value, tickers: [], ...overrides }) as PortfolioAnalyticsShare;

const analytics: PortfolioAnalytics = {
  valueInRub: 3175.5,
  bonds: 5,
  unvalued: [
    { ticker: 'RU000A10ECY6', bondName: 'Ойл Ресурс Групп 001Р-02', reason: 'NO_PRICE' },
    { ticker: 'GONE', bondName: null, reason: 'UNKNOWN_BOND' },
  ],
  issuers: [
    share('100', 1220, 38.42, { title: 'Министерство финансов РФ', tickers: ['SU26238RMFS4'] }),
    share('200', 1005, 31.65, { title: 'ПАО "Авто Финанс Банк"', tickers: ['RU000A10EQ34'] }),
    share(null, 950.5, 29.93, { tickers: ['RU000A10EHC1'] }),
  ],
  sectors: [share('government', 1220, 38.42), share('financial', 1005, 31.65), share('consumer', 950.5, 29.93)],
  ratings: [share('A+', 1005, 31.65, { title: 'A+' }), share(null, 2170.5, 68.35)],
  currencies: [share('rub', 3175.5, 100)],
  couponTypes: [share('FIXED', 2225, 70.07), share('FLOATING', 950.5, 29.93)],
  maturities: [share('2029', 1005, 31.65), share('2036', 950.5, 29.93), share('2041', 1220, 38.42)],
  yieldToMaturity: { value: 16.98, coveredShare: 70.07 },
  durationMacaulay: { value: 5.2, coveredShare: 70.07 },
  durationModified: { value: 3.3338, coveredShare: 100 },
  largestIssuer: share('100', 1220, 38.42, { title: 'Министерство финансов РФ' }),
  rateSensitivity: {
    shiftPercent: 1,
    valueChangeUp: -103.49,
    valueChangeDown: 103.49,
    changePercent: 4.65,
    coveredShare: 70.07,
  },
};

const EMPTY_PORTFOLIO: Portfolio = { groups: [], totals: [], summary: null, closed: [], incomeTotals: [], income: null };

// Intl в ru-RU разделяет разряды неразрывным пробелом - сравниваем текст с обычными пробелами
const normalized = (text: string) => (_: string, element: Element | null) =>
  element?.textContent?.replace(/\s/g, ' ') === text && element.children.length === 0;

function mockApi(current: PortfolioAnalytics = analytics) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    const body = url.startsWith('/api/portfolio/analytics') ? current : EMPTY_PORTFOLIO;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

const renderAnalytics = () => renderRoute(<PortfolioPage />, { path: '/portfolio', url: '/portfolio?tab=analytics' });

afterEach(() => vi.unstubAllGlobals());

describe('PortfolioPage: аналитика', () => {
  it('аналитика не запрашивается, пока вкладка не открыта', async () => {
    const calls = mockApi();
    renderRoute(<PortfolioPage />, { path: '/portfolio', url: '/portfolio' });

    expect(await screen.findByText(/В портфеле пока ничего нет/)).toBeInTheDocument();
    expect(calls.some((url) => url.includes('/analytics'))).toBe(false);

    await userEvent.click(screen.getByRole('tab', { name: 'Аналитика' }));

    expect(await screen.findByText('Эмитенты')).toBeInTheDocument();
    expect(calls).toContain('/api/portfolio/analytics');
  });

  it('доли, «нет данных» и позиции без оценки', async () => {
    mockApi();
    renderAnalytics();

    const issuers = (await screen.findByText('Эмитенты')).closest('.mantine-Card-root') as HTMLElement;
    const rows = within(issuers).getAllByTestId('share-row');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Министерство финансов РФ'),
      expect.stringContaining('ПАО "Авто Финанс Банк"'),
      expect.stringContaining('Нет данных'),
    ]);
    expect(within(rows[0]!).getByText(normalized('38,42 %'))).toBeInTheDocument();

    // секторы по-русски, рейтинг без данных - своей подписью
    expect(screen.getByText('Госсектор')).toBeInTheDocument();
    expect(screen.getByText('Без рейтинга АКРА и НКР')).toBeInTheDocument();
    expect(screen.getByText('Переменный купон (флоатер)')).toBeInTheDocument();
    expect(screen.getByText('RUB')).toBeInTheDocument();
    // доля всегда с двумя знаками: 100 - «100,00 %», не «100 %»
    const currencies = screen.getByText('Валюта номинала').closest('.mantine-Card-root') as HTMLElement;
    expect(within(currencies).getByText(normalized('100,00 %'))).toBeInTheDocument();

    // не оценённые - названы с причиной
    expect(screen.getByText('Не вошли в доли')).toBeInTheDocument();
    expect(screen.getByText(/Ойл Ресурс Групп 001Р-02 \(RU000A10ECY6\) - нет текущей цены/)).toBeInTheDocument();
    expect(screen.getByText(/GONE \(GONE\) - облигации нет в системе/)).toBeInTheDocument();
  });

  it('средние, крупнейший эмитент и чувствительность к ставке', async () => {
    mockApi();
    renderAnalytics();

    // стоимость - в карточке и у единственной валюты
    expect(await screen.findAllByText(normalized('3 175,50 ₽'))).toHaveLength(2);
    expect(screen.getByText(normalized('16,98 %'))).toBeInTheDocument();
    expect(screen.getByText('Доходность к погашению').parentElement?.textContent?.replace(/\s/g, ' ')).toContain(
      'по 70,07 % стоимости',
    );
    expect(screen.getByText('Крупнейший эмитент').parentElement).toHaveTextContent('Министерство финансов РФ');
    expect(screen.getByText(/доходность \+1 п\.п\.: −103,49/)).toBeInTheDocument();
    expect(screen.getByText(/доходность −1 п\.п\.: \+103,49/)).toBeInTheDocument();
    expect(screen.getByText(/флоатеры и облигации без дюрации не учтены/)).toBeInTheDocument();
    expect(screen.getByText('Погашения по годам, ₽')).toBeInTheDocument();
  });

  it('пустой портфель и портфель без оценённых позиций', async () => {
    mockApi({ ...analytics, bonds: 0, valueInRub: null, unvalued: [] });
    const { unmount } = renderAnalytics();
    expect(await screen.findByText(/Аналитика появится, когда в портфеле будут облигации/)).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    mockApi({
      ...analytics,
      bonds: 1,
      valueInRub: null,
      unvalued: [{ ticker: 'GONE', bondName: null, reason: 'UNKNOWN_BOND' }],
    });
    renderAnalytics();
    expect(await screen.findByText('Не вошли в доли')).toBeInTheDocument();
    expect(screen.queryByText('Эмитенты')).not.toBeInTheDocument();
  });
});
