import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Bond, BondSearchItem, Portfolio, PortfolioPosition } from '../api/types';
import { renderRoute } from '../test/render';
import { PortfolioPage } from './PortfolioPage';

const position = (overrides: Partial<PortfolioPosition>): PortfolioPosition => ({
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
  createdAt: '2026-11-08T10:00:00Z',
  ...overrides,
});

const portfolio: Portfolio = {
  positions: [
    position({}),
    position({
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
    }),
  ],
  totals: [{ currency: 'rub', buyAmount: 11250, currentAmount: 11270, revenue: 20, revenuePercent: 0.18 }],
};

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

const renderPage = () => renderRoute(<PortfolioPage />, { path: '/portfolio', url: '/portfolio' });

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

  it('пустой портфель', async () => {
    mockApi({ positions: [], totals: [] });
    renderPage();

    expect(await screen.findByText(/В портфеле пока ничего нет/)).toBeInTheDocument();
  });

  it('добавляет покупку по текущей цене выбранной облигации', async () => {
    const calls = mockApi({ positions: [], totals: [] });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить покупку' }));
    await userEvent.type(await screen.findByPlaceholderText('Тикер, ISIN или название'), 'абз');
    await userEvent.click(await screen.findByText('АБЗ-1 002P-04'));
    await waitFor(() => expect(screen.getByLabelText('Цена покупки, % номинала')).toHaveValue('101,07'));

    const quantity = screen.getByLabelText('Количество, шт.');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'POST')).toBe(true));
    const post = calls.find((call) => call.init?.method === 'POST')!;
    expect(post.url).toBe('/api/portfolio/positions');
    expect(JSON.parse(String(post.init?.body))).toMatchObject({
      ticker: 'RU000A10DCK7',
      quantity: 5,
      buyPrice: 101.07,
    });
  });

  it('не отправляет покупку без облигации', async () => {
    const calls = mockApi({ positions: [], totals: [] });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить покупку' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить' }));

    expect(screen.getByText('Выберите облигацию')).toBeInTheDocument();
    expect(calls.some((call) => call.init?.method === 'POST')).toBe(false);
  });

  it('изменяет покупку', async () => {
    const calls = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить покупку: ОФЗ 26238' }));
    const dialog = await screen.findByRole('dialog');
    const quantity = within(dialog).getByLabelText('Количество, шт.');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '4');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.init?.method === 'PUT')!;
    expect(put.url).toBe('/api/portfolio/positions/2');
    expect(JSON.parse(String(put.init?.body))).toEqual({ quantity: 4, buyPrice: 70, buyDate: '2026-01-15', broker: '' });
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

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить покупку: ОФЗ 26238' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('Брокер'));
    await userEvent.click(await screen.findByText('Альфа'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.init?.method === 'PUT')!;
    expect(JSON.parse(String(put.init?.body))).toMatchObject({ broker: 'Альфа' });
  });

  it('добавляет нового брокера', async () => {
    const calls = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Изменить покупку: ОФЗ 26238' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Брокер'), 'Финам');
    await userEvent.click(await screen.findByText('+ Добавить «Финам»'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.init?.method === 'PUT')!;
    expect(JSON.parse(String(put.init?.body))).toMatchObject({ broker: 'Финам' });
  });

  it('удаляет покупку после подтверждения', async () => {
    const calls = mockApi();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить покупку: ОФЗ 26238' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }));

    await waitFor(() =>
      expect(calls.some((call) => call.init?.method === 'DELETE' && call.url === '/api/portfolio/positions/2')).toBe(true),
    );
  });
});
