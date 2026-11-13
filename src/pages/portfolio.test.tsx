import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Bond, BondSearchItem, Portfolio, PortfolioGroup, PortfolioPosition } from '../api/types';
import { renderRoute } from '../test/render';
import { enableAnalytics, sentGoals } from '../test/analytics';
import { PortfolioPage } from './PortfolioPage';

const position = (overrides: Partial<PortfolioPosition>): PortfolioPosition => {
  const base = positionBase(overrides);
  return { ...base, remainingQuantity: overrides.remainingQuantity ?? base.quantity };
};

const positionBase = (overrides: Partial<PortfolioPosition>): PortfolioPosition => ({
  id: 1,
  ticker: 'RU000A10EQ34',
  bondName: 'Авто Финанс Банк БО-001Р-18',
  isin: 'RU000A10EQ34',
  currency: 'rub',
  quantity: 10,
  buyDate: '2026-01-15',
  broker: 'Т-Инвестиции',
  nominal: 1000,
  buyPrice: 98.5,
  currentPrice: 100.5,
  buyAmount: 9850,
  currentAmount: 10050,
  revenue: 200,
  revenuePercent: 2.03,
  buyAmountRub: null,
  buyAmountInRub: 9850,
  currentAmountInRub: 10050,
  revenueInRub: 200,
  yieldToMaturity: 19.4,
  aci: null,
  commission: null,
  remainingQuantity: 10,
  createdAt: '2026-11-08T10:00:00Z',
  ...overrides,
});

/** Строка облигации из покупок - так же, как её сводит бэк */
function group(positions: PortfolioPosition[], overrides: Partial<PortfolioGroup> = {}): PortfolioGroup {
  const first = positions[0]!;
  const sum = (field: (p: PortfolioPosition) => number | null) => positions.reduce((total, p) => total + (field(p) ?? 0), 0);
  const quantity = sum((p) => p.quantity);
  const dates = positions.map((p) => p.buyDate).sort();
  return {
    ticker: first.ticker,
    bondName: first.bondName,
    isin: first.isin,
    currency: first.currency,
    quantity,
    brokers: [...new Set(positions.map((p) => p.broker).filter((b): b is string => b != null))].sort(),
    firstBuyDate: dates[0]!,
    lastBuyDate: dates[dates.length - 1]!,
    nominal: first.nominal,
    buyPrice: sum((p) => p.buyPrice * p.quantity) / quantity,
    currentPrice: first.currentPrice,
    buyAmount: sum((p) => p.buyAmount),
    currentAmount: sum((p) => p.currentAmount),
    revenue: sum((p) => p.revenue),
    revenuePercent: first.revenuePercent,
    buyAmountInRub: sum((p) => p.buyAmountInRub),
    currentAmountInRub: sum((p) => p.currentAmountInRub),
    revenueInRub: sum((p) => p.revenueInRub),
    couponRate: 18.59,
    yieldToMaturity: first.yieldToMaturity,
    currentYieldToMaturity: 18.2,
    income: null,
    positions,
    ...overrides,
  };
}

const ofz = position({
  id: 2,
  ticker: 'SU26238RMFS4',
  bondName: 'ОФЗ 26238',
  broker: null,
  quantity: 2,
  buyPrice: 70,
  currentPrice: 61,
  buyAmount: 1400,
  currentAmount: 1220,
  revenue: -180,
  revenuePercent: -12.86,
});

const portfolio: Portfolio = {
  groups: [group([position({})]), group([ofz])],
  totals: [
    {
      currency: 'rub',
      buyAmount: 11250,
      currentAmount: 11270,
      revenue: 20,
      revenuePercent: 0.18,
      buyAmountInRub: 11250,
      currentAmountInRub: 11270,
      revenueInRub: 20,
    },
  ],
  summary: null,
  closed: [],
  incomeTotals: [],
  income: null,
};

const EMPTY: Portfolio = { groups: [], totals: [], summary: null, closed: [], incomeTotals: [], income: null };

/** ТМК: две покупки у разных брокеров - одна строка */
const tmkFirst = position({
  id: 5,
  ticker: 'RU000A107JN3',
  bondName: 'ТМК ЗО-2027',
  currency: 'usd',
  quantity: 1,
  buyDate: '2025-09-19',
  broker: 'АльфаБанк',
  buyPrice: 95.5,
  currentPrice: 94.42,
  buyAmount: 954.99,
  currentAmount: 944.15,
  revenue: -10.84,
  revenuePercent: -1.14,
  buyAmountRub: 77500,
  buyAmountInRub: 77500,
  currentAmountInRub: 77551.16,
  revenueInRub: 51.16,
});
const tmkSecond = position({
  ...tmkFirst,
  id: 6,
  buyDate: '2026-11-08',
  broker: 'Т-Инвестиции',
  buyPrice: 94.42,
  buyAmount: 944.15,
  revenue: 0,
  revenuePercent: 0,
  buyAmountRub: null,
  buyAmountInRub: 77551.16,
  revenueInRub: 0,
});
const tmk = group([tmkFirst, tmkSecond], { revenuePercent: -0.57 });

const bond = {
  ticker: 'RU000A10DCK7',
  name: 'АБЗ-1 002P-04',
  price: { percentagePrice: 101.07, nominal: { quantity: 1000, currency: 'rub' } },
} as Bond;

const found: BondSearchItem = {
  ticker: bond.ticker,
  uid: 'uid-1',
  isin: bond.ticker,
  name: bond.name,
  sector: 'industrials',
  currency: 'rub',
  riskLevel: 'RISK_LEVEL_LOW',
  maturityDate: '2030-10-16T00:00:00Z',
};

// Intl в ru-RU разделяет разряды неразрывным пробелом - сравниваем текст с обычными пробелами
const byText = (text: string) => (_: string, element: Element | null) =>
  element?.textContent?.replace(/\s/g, ' ') === text && element.children.length === 0;

function mockApi(current: Portfolio = portfolio) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const method = init?.method ?? 'GET';
    if (method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    const body = url.endsWith('/api/portfolio/brokers')
      ? [
          { id: 1, name: 'Альфа' },
          { id: 2, name: 'Т-Инвестиции' },
        ]
      : url.includes('/search')
        ? [found]
        : url.startsWith('/api/bonds/')
          ? bond
          : method === 'GET'
            ? current
            : position({ id: 3 });
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

const sent = (calls: { url: string; init?: RequestInit }[], method: string) => {
  const call = calls.find((c) => c.init?.method === method)!;
  return { url: call.url, body: JSON.parse(String(call.init?.body)) as Record<string, unknown> };
};

const renderPage = () => renderRoute(<PortfolioPage />, { path: '/portfolio', url: '/portfolio' });

/** Действия покупок - в раскрытой строке облигации */
async function expand(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Показать покупки: ${name}` }));
}

afterEach(() => vi.unstubAllGlobals());

describe('PortfolioPage', () => {
  it('показывает покупки с доходом и итог', async () => {
    mockApi();
    renderPage();

    expect(await screen.findByText('Авто Финанс Банк БО-001Р-18')).toBeInTheDocument();
    expect(screen.getByText(byText('+200,00 ₽'))).toBeInTheDocument();
    expect(screen.getByText('+2,03 %')).toBeInTheDocument();
    // убыток - со знаком минус
    expect(screen.getByText(byText('−180,00 ₽'))).toBeInTheDocument();
    expect(screen.getByText('−12,86 %')).toBeInTheDocument();
    // итог по рублям
    expect(screen.getByText(byText('11 270,00 ₽'))).toBeInTheDocument();
    expect(screen.getByText(byText('+20,00 ₽ (+0,18 %)'))).toBeInTheDocument();
  });

  it('весь портфель в рублях, купон и доходность к погашению по цене покупки', async () => {
    mockApi({
      ...portfolio,
      summary: { buyAmountInRub: 600000, currentAmountInRub: 612345.67, revenueInRub: 12345.67, revenuePercent: 2.06 },
    });
    renderPage();

    expect(await screen.findByText('Всего, в рублях')).toBeInTheDocument();
    expect(screen.getByText(byText('612 345,67 ₽'))).toBeInTheDocument();
    expect(screen.getByText(byText('+12 345,67 ₽ (+2,06 %)'))).toBeInTheDocument();

    const row = screen.getByText('Авто Финанс Банк БО-001Р-18').closest('tr')!;
    expect(within(row).getByText('18,59 %')).toBeInTheDocument();
    expect(within(row).getByText('19,4 %')).toBeInTheDocument();
    expect(within(row).getByText('сейчас 18,2 %')).toBeInTheDocument();
  });

  it('без курса у какой-то валюты карточки «Всего» нет', async () => {
    mockApi({ ...portfolio, summary: null, closed: [], incomeTotals: [], income: null });
    renderPage();

    expect(await screen.findByText('Авто Финанс Банк БО-001Р-18')).toBeInTheDocument();
    expect(screen.queryByText('Всего, в рублях')).not.toBeInTheDocument();
  });

  it('пустой портфель', async () => {
    mockApi(EMPTY);
    renderPage();

    expect(await screen.findByText(/В портфеле пока ничего нет/)).toBeInTheDocument();
  });

  it('покупки одной облигации - одной строкой, раскрываются по клику', async () => {
    mockApi({ groups: [tmk], totals: [], summary: null, closed: [], incomeTotals: [], income: null });
    renderPage();

    const row = (await screen.findByText('ТМК ЗО-2027')).closest('tr')!;
    expect(within(row).getByText(/2 покупки/)).toBeInTheDocument();
    expect(within(row).getByText('2 брокера')).toBeInTheDocument();
    expect(within(row).getByText('19.09.2025 – 08.11.2026')).toBeInTheDocument();

    // покупки не видны, пока строку не раскрыли
    expect(screen.queryByRole('button', { name: 'Изменить покупку: ТМК ЗО-2027 от 19.09.2025' })).not.toBeInTheDocument();

    await userEvent.click(within(row).getByRole('button', { name: 'Показать покупки: ТМК ЗО-2027' }));

    expect(screen.getByRole('button', { name: 'Изменить покупку: ТМК ЗО-2027 от 19.09.2025' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Изменить покупку: ТМК ЗО-2027 от 08.11.2026' })).toBeInTheDocument();
    expect(screen.getByText('АльфаБанк')).toBeInTheDocument();
    // у покупки с введённой рублёвой суммой она видна под ценой
    expect(screen.getByText(byText('77 500,00 ₽'))).toBeInTheDocument();
  });

  it('строка облигации с одной покупкой - сама покупка, раскрывать нечего', async () => {
    mockApi();
    renderPage();

    const row = (await screen.findByText('ОФЗ 26238')).closest('tr')!;
    expect(within(row).getByRole('button', { name: 'Изменить покупку: ОФЗ 26238 от 15.01.2026' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Удалить покупку: ОФЗ 26238 от 15.01.2026' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Добавить покупку: ОФЗ 26238' })).toBeInTheDocument();
    // стрелки нет - не будет второй строки с той же покупкой
    expect(within(row).queryByRole('button', { name: /Показать покупки/ })).not.toBeInTheDocument();
    expect(within(row).queryByText(/покупк/)).not.toBeInTheDocument();
  });

  it('«+» в строке облигации открывает покупку этой облигации', async () => {
    const calls = mockApi({ groups: [tmk], totals: [], summary: null, closed: [], incomeTotals: [], income: null });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить покупку: ТМК ЗО-2027' }));
    const dialog = await screen.findByRole('dialog');
    // цена по умолчанию - текущая цена облигации, без поиска
    expect(within(dialog).getByLabelText('Цена покупки, % номинала')).toHaveValue('94,42');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'POST')).toBe(true));
    expect(sent(calls, 'POST').body).toMatchObject({ ticker: 'RU000A107JN3', quantity: 1, buyPrice: 94.42 });
  });

  it('добавляет покупку по текущей цене выбранной облигации', async () => {
    const ym = enableAnalytics();
    const calls = mockApi(EMPTY);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить покупку' }));
    await userEvent.type(await screen.findByPlaceholderText('Тикер, ISIN или название'), 'абз');
    await userEvent.click(await screen.findByText('АБЗ-1 002P-04'));
    await waitFor(() => expect(screen.getByLabelText('Цена покупки, % номинала')).toHaveValue('101,07'));
    // рублёвая облигация - поля «Заплачено, ₽» нет
    expect(screen.queryByLabelText(/Заплачено/)).not.toBeInTheDocument();

    const quantity = screen.getByLabelText('Количество, шт.');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'POST')).toBe(true));
    const post = sent(calls, 'POST');
    expect(post.url).toBe('/api/portfolio/positions');
    expect(post.body).toMatchObject({ ticker: 'RU000A10DCK7', quantity: 5, buyPrice: 101.07 });
    expect(post.body.buyAmountRub).toBeUndefined();
    // цель без тикера и сумм: что лежит в портфеле - личное
    await waitFor(() => expect(sentGoals(ym)).toEqual([['portfolio_position_added', undefined]]));
  });

  it('у валютной покупки можно указать, сколько заплачено в рублях', async () => {
    const calls = mockApi({ groups: [tmk], totals: [], summary: null, closed: [], incomeTotals: [], income: null });
    renderPage();

    await expand('ТМК ЗО-2027');
    await userEvent.click(screen.getByRole('button', { name: 'Изменить покупку: ТМК ЗО-2027 от 08.11.2026' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Заплачено/), '76900');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true));
    expect(sent(calls, 'PUT')).toMatchObject({ url: '/api/portfolio/positions/6', body: { buyAmountRub: 76900 } });
  });

  it('запятая и точка в дробной части не стирают набранное', async () => {
    const calls = mockApi({ groups: [tmk], totals: [], summary: null, closed: [], incomeTotals: [], income: null });
    renderPage();

    await expand('ТМК ЗО-2027');
    await userEvent.click(screen.getByRole('button', { name: 'Изменить покупку: ТМК ЗО-2027 от 08.11.2026' }));
    const dialog = await screen.findByRole('dialog');

    const paid = within(dialog).getByLabelText(/Заплачено/);
    await userEvent.type(paid, '79,');
    expect(paid).toHaveValue('79,');
    await userEvent.type(paid, '5');
    expect(paid).toHaveValue('79,5');

    // точка - тоже разделитель дробной части, в поле она становится запятой
    const price = within(dialog).getByLabelText('Цена покупки, % номинала');
    await userEvent.clear(price);
    await userEvent.type(price, '95.');
    expect(price).toHaveValue('95,');
    await userEvent.type(price, '499');
    expect(price).toHaveValue('95,499');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true));
    expect(sent(calls, 'PUT').body).toMatchObject({ buyPrice: 95.499, buyAmountRub: 79.5 });
  });

  it('не отправляет покупку без облигации', async () => {
    const calls = mockApi(EMPTY);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить покупку' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить' }));

    expect(screen.getByText('Выберите облигацию')).toBeInTheDocument();
    expect(calls.some((call) => call.init?.method === 'POST')).toBe(false);
  });

  it('изменяет покупку', async () => {
    const calls = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить покупку: ОФЗ 26238 от 15.01.2026' }));
    const dialog = await screen.findByRole('dialog');
    const quantity = within(dialog).getByLabelText('Количество, шт.');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '4');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true));
    expect(sent(calls, 'PUT')).toEqual({
      url: '/api/portfolio/positions/2',
      body: { quantity: 4, buyPrice: 70, buyDate: '2026-01-15', broker: '' },
    });
  });

  it('показывает рубли под суммами в валюте и не показывает у рублёвых', async () => {
    mockApi({
      groups: [group([tmkFirst]), group([position({})])],
      totals: [
        {
          currency: 'usd',
          buyAmount: 954.99,
          currentAmount: 944.15,
          revenue: -10.84,
          revenuePercent: -1.14,
          buyAmountInRub: 77500,
          currentAmountInRub: 77551.16,
          revenueInRub: 51.16,
        },
      ],
      summary: null,
      closed: [],
      incomeTotals: [],
      income: null,
    });
    renderPage();

    const usdRow = (await screen.findByText('ТМК ЗО-2027')).closest('tr')!;
    expect(within(usdRow).getByText(byText('77 551,16 ₽'))).toBeInTheDocument();
    // в долларах убыток, в рублях - прибыль: доллар подорожал с даты покупки
    expect(within(usdRow).getByText(byText('+51,16 ₽'))).toBeInTheDocument();
    // в итоге - те же подписи
    expect(screen.getAllByText(byText('77 551,16 ₽'))).toHaveLength(2);
    // у рублёвой покупки рубли не повторяются
    const rubRow = screen.getByText('Авто Финанс Банк БО-001Р-18').closest('tr')!;
    expect(within(rubRow).getAllByText(byText('10 050,00 ₽'))).toHaveLength(1);
    expect(screen.queryByText(/куплено на/)).not.toBeInTheDocument();
  });

  it('показывает брокера покупки', async () => {
    mockApi();
    renderPage();

    const row = (await screen.findByText('Авто Финанс Банк БО-001Р-18')).closest('tr')!;
    expect(within(row).getByText('Т-Инвестиции')).toBeInTheDocument();
  });

  it('выбирает брокера из уже заведённых', async () => {
    const calls = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить покупку: ОФЗ 26238 от 15.01.2026' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('Брокер'));
    await userEvent.click(await screen.findByText('Альфа'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true));
    expect(sent(calls, 'PUT').body).toMatchObject({ broker: 'Альфа' });
  });

  it('добавляет нового брокера', async () => {
    const calls = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить покупку: ОФЗ 26238 от 15.01.2026' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Брокер'), 'Финам');
    await userEvent.click(await screen.findByText('+ Добавить «Финам»'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true));
    expect(sent(calls, 'PUT').body).toMatchObject({ broker: 'Финам' });
  });

  it('удаляет покупку после подтверждения', async () => {
    const calls = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить покупку: ОФЗ 26238 от 15.01.2026' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }));

    await waitFor(() =>
      expect(calls.some((call) => call.init?.method === 'DELETE' && call.url === '/api/portfolio/positions/2')).toBe(true),
    );
  });
});
