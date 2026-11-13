import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Portfolio, PortfolioGroup, PortfolioIncome, PortfolioPosition, PortfolioTrade } from '../api/types';
import { renderRoute } from '../test/render';
import { PortfolioPage } from './PortfolioPage';

const income = (overrides: Partial<PortfolioIncome> = {}): PortfolioIncome => ({
  currency: 'rub',
  buyAmount: 9500,
  buyAci: 0,
  couponIncome: 1000,
  amortizationIncome: 0,
  soldAmount: 0,
  saleAci: 0,
  currentAmount: 10000,
  currentAci: 0,
  commission: 20,
  priceIncome: 500,
  aciIncome: 0,
  profit: 1480,
  taxRatePercent: 13,
  tax: 192.4,
  fullIncome: 1287.6,
  fullIncomePercent: 13.55,
  xirr: 16.01,
  unknownCouponCount: 0,
  incomplete: false,
  ...overrides,
});

const position: PortfolioPosition = {
  id: 1,
  ticker: 'SU26238RMFS4',
  bondName: 'ОФЗ 26238',
  isin: 'RU000A1038V6',
  currency: 'rub',
  quantity: 10,
  remainingQuantity: 4,
  buyDate: '2026-01-15',
  broker: null,
  nominal: 1000,
  buyPrice: 95,
  currentPrice: 100,
  buyAmount: 3800,
  currentAmount: 4000,
  revenue: 200,
  revenuePercent: 5.26,
  buyAmountRub: null,
  buyAmountInRub: 3800,
  currentAmountInRub: 4000,
  revenueInRub: 200,
  yieldToMaturity: 12,
  aci: null,
  commission: 10,
  createdAt: '2026-11-08T10:00:00Z',
};

const group: PortfolioGroup = {
  ticker: position.ticker,
  bondName: position.bondName,
  isin: position.isin,
  currency: 'rub',
  quantity: 4,
  brokers: [],
  firstBuyDate: position.buyDate,
  lastBuyDate: position.buyDate,
  nominal: 1000,
  buyPrice: 95,
  currentPrice: 100,
  buyAmount: 3800,
  currentAmount: 4000,
  revenue: 200,
  revenuePercent: 5.26,
  buyAmountInRub: 3800,
  currentAmountInRub: 4000,
  revenueInRub: 200,
  couponRate: 7,
  yieldToMaturity: 12,
  currentYieldToMaturity: 11,
  income: income(),
  positions: [position, { ...position, id: 2, quantity: 3, remainingQuantity: 0, buyDate: '2025-12-01' }],
};

const portfolio: Portfolio = {
  groups: [group],
  totals: [],
  summary: null,
  closed: [],
  incomeTotals: [income()],
  income: income(),
};

const trades: PortfolioTrade[] = [
  {
    type: 'REDEMPTION',
    id: null,
    ticker: 'RU000A10EQ34',
    bondName: 'Авто Финанс',
    currency: 'rub',
    date: '2026-11-01',
    quantity: 2,
    price: 100,
    amount: 2000,
    aci: 0,
    aciCalculated: false,
    commission: null,
    broker: null,
  },
  {
    type: 'SALE',
    id: 7,
    ticker: position.ticker,
    bondName: position.bondName,
    currency: 'rub',
    date: '2026-10-01',
    quantity: 6,
    price: 67.635,
    amount: 6060,
    aci: 12.5,
    aciCalculated: true,
    commission: 3,
    broker: 'Финам',
  },
  {
    type: 'BUY',
    id: 1,
    ticker: position.ticker,
    bondName: position.bondName,
    currency: 'rub',
    date: '2026-01-15',
    quantity: 10,
    price: 95,
    amount: 9500,
    aci: 0,
    aciCalculated: true,
    commission: 10,
    broker: null,
  },
];

// Intl в ru-RU разделяет разряды неразрывным пробелом - сравниваем текст с обычными пробелами
const byText = (text: string) => (_: string, element: Element | null) =>
  element?.textContent?.replace(/\s/g, ' ') === text && element.children.length === 0;

const SALE_REJECTED = { title: 'Unprocessable Entity', status: 422, detail: 'Не хватает облигаций SU26238RMFS4' };

function mockApi(current: Portfolio = portfolio, { rejectSale = false } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const method = init?.method ?? 'GET';
    if (method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (rejectSale && method === 'POST') {
      return new Response(JSON.stringify(SALE_REJECTED), {
        status: 422,
        headers: { 'Content-Type': 'application/problem+json' },
      });
    }
    const body = url.endsWith('/api/portfolio/brokers')
      ? []
      : url.endsWith('/api/portfolio/trades')
        ? trades
        : method === 'GET'
          ? current
          : trades[1];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

const renderPage = (url = '/portfolio') => renderRoute(<PortfolioPage />, { path: '/portfolio', url });

afterEach(() => vi.unstubAllGlobals());

describe('PortfolioPage: полный доход', () => {
  it('полный доход и XIRR портфеля и облигации', async () => {
    mockApi();
    renderPage();

    expect(await screen.findByText('Полный доход, в рублях')).toBeInTheDocument();
    expect(screen.getByText('XIRR 16,01 %')).toBeInTheDocument();
    const row = screen.getByText('ОФЗ 26238').closest('tr')!;
    expect(within(row).getByText(byText('+1 287,60 ₽'))).toBeInTheDocument();
    expect(within(row).getByText('+13,55 %')).toBeInTheDocument();
    expect(within(row).getByText('16,01 %')).toBeInTheDocument();
  });

  it('ставка НДФЛ - 13 % по умолчанию, «Без НДФЛ» перечитывает портфель без ставки', async () => {
    const calls = mockApi();
    renderPage();

    await screen.findByText('Полный доход, в рублях');
    expect(calls.some((call) => call.url === '/api/portfolio?taxRatePercent=13')).toBe(true);

    await userEvent.click(screen.getByText('Без НДФЛ'));

    await waitFor(() => expect(calls.some((call) => call.url === '/api/portfolio')).toBe(true));
  });

  it('проданная часть покупки видна как «осталось из куплено»', async () => {
    mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Показать покупки: ОФЗ 26238' }));

    expect(screen.getByText('4 из 10')).toBeInTheDocument();
    expect(screen.getByText('0 из 3')).toBeInTheDocument();
  });

  it('неполный итог помечен звёздочкой', async () => {
    mockApi({ ...portfolio, income: income({ incomplete: true, unknownCouponCount: 2, xirr: null }) });
    renderPage();

    await screen.findByText('Полный доход, в рублях');
    expect(screen.getAllByLabelText('Итог неполный').length).toBeGreaterThan(0);
    // XIRR неполного итога не считается - в карточке его нет
    expect(screen.queryByText(/^XIRR \d/)).not.toBeInTheDocument();
  });

  it('продажа из строки облигации', async () => {
    const calls = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Продать: ОФЗ 26238' }));
    const dialog = await screen.findByRole('dialog');
    // по умолчанию - всё, что есть, по текущей цене
    expect(within(dialog).getByLabelText(/Количество/)).toHaveValue('4');
    expect(within(dialog).getByLabelText(/Цена продажи/)).toHaveValue('100');
    expect(within(dialog).getByText('В портфеле 4 шт.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Комиссия/), '5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Продать' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'POST')).toBe(true));
    const post = calls.find((call) => call.init?.method === 'POST')!;
    expect(post.url).toBe('/api/portfolio/sales');
    const body = JSON.parse(String(post.init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ ticker: 'SU26238RMFS4', quantity: 4, sellPrice: 100, commission: 5 });
    // НКД не вводили - его посчитает бэк по графику купонов
    expect(body.aci).toBeUndefined();
  });

  it('закрытые позиции, когда открытых нет', async () => {
    mockApi({
      ...portfolio,
      groups: [],
      closed: [
        {
          ticker: 'RU000A10EQ34',
          bondName: 'Авто Финанс',
          isin: 'RU000A10EQ34',
          currency: 'rub',
          quantity: 2,
          firstBuyDate: '2026-01-10',
          closeDate: '2026-11-01',
          income: income({ fullIncome: 40, fullIncomePercent: 2.02, xirr: 2.3 }),
        },
      ],
    });
    renderPage();

    expect(await screen.findByText('Закрытые позиции')).toBeInTheDocument();
    const row = screen.getByText('Авто Финанс').closest('tr')!;
    expect(within(row).getByText('10.01.2026 – 01.11.2026')).toBeInTheDocument();
    expect(within(row).getByText(byText('+40,00 ₽'))).toBeInTheDocument();
    expect(screen.queryByText(/В портфеле пока ничего нет/)).not.toBeInTheDocument();
  });

  it('вкладка «Сделки»: покупки, продажи, погашения; продажа удаляется', async () => {
    const calls = mockApi();
    renderPage('/portfolio?tab=trades');

    expect(await screen.findByText('Погашение')).toBeInTheDocument();
    expect(screen.getByText('Продажа')).toBeInTheDocument();
    expect(screen.getByText('Покупка')).toBeInTheDocument();
    // НКД не вводили - посчитан по графику
    expect(screen.getAllByText('по графику').length).toBe(2);
    // у покупки и погашения действий нет
    expect(screen.queryByRole('button', { name: /Удалить продажу: ОФЗ 26238 от 15.01.2026/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить продажу: ОФЗ 26238 от 01.10.2026' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }));

    await waitFor(() =>
      expect(calls.some((call) => call.init?.method === 'DELETE' && call.url === '/api/portfolio/sales/7')).toBe(true),
    );
  });
  it('цена сделки - с точностью до 4 знаков', async () => {
    mockApi();
    renderPage('/portfolio?tab=trades');

    expect(await screen.findByText('67,635 %')).toBeInTheDocument();
  });

  it('«Добавить продажу» предлагает только облигации из портфеля', async () => {
    const calls = mockApi();
    renderPage('/portfolio?tab=trades');

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить продажу' }));
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText('Облигация');
    // список - облигации портфеля, он приходит вместе с портфелем
    await waitFor(() => expect(select).toBeEnabled());
    // в списке - только облигации портфеля: «Авто» (есть в сделках, но продана) не находится
    await userEvent.type(select, 'Авто');
    expect(await within(document.body).findByText('Нет в портфеле')).toBeInTheDocument();
    await userEvent.clear(select);
    await userEvent.type(select, 'ОФЗ{ArrowDown}{Enter}');
    expect(select).toHaveValue('ОФЗ 26238');

    // по умолчанию - всё непроданное по текущей цене
    expect(within(dialog).getByLabelText(/Количество/)).toHaveValue('4');
    expect(within(dialog).getByLabelText(/Цена продажи/)).toHaveValue('100');
    // поиска по всем облигациям нет
    expect(calls.some((call) => call.url.includes('/search'))).toBe(false);
  });

  it('ошибка бэка пропадает, когда поле изменили', async () => {
    mockApi(portfolio, { rejectSale: true });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Продать: ОФЗ 26238' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Продать' }));
    expect(await within(dialog).findByText(/Не хватает облигаций/)).toBeInTheDocument();

    const quantity = within(dialog).getByLabelText(/Количество/);
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '2');

    expect(within(dialog).queryByText(/Не хватает облигаций/)).not.toBeInTheDocument();
  });
});
