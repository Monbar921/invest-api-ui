import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Bond, Page } from '../api/types';
import { mockFetch, renderRoute } from '../test/render';
import { BondPage } from './BondPage';
import { BondsPage } from './BondsPage';

const bond = (ticker: string, overrides: Partial<Bond> = {}): Bond => ({
  ticker,
  uid: `uid-${ticker}`,
  isin: ticker,
  name: `Облигация ${ticker}`,
  price: {
    uid: null,
    nominal: { quantity: 1000, currency: 'rub' },
    current: { quantity: 950, currency: 'rub' },
    percentagePrice: 95,
  },
  coupon: { uid: null, quantityPerYear: 4, interest: 12.5, couponData: null },
  riskLevel: 'RISK_LEVEL_LOW',
  maturityDate: '2030-01-01T00:00:00Z',
  ...overrides,
});

const page = (content: Bond[], overrides: Partial<Page<Bond>> = {}): Page<Bond> => ({
  content,
  page: 0,
  size: 50,
  totalElements: content.length,
  totalPages: 1,
  ...overrides,
});

afterEach(() => vi.unstubAllGlobals());

describe('BondsPage', () => {
  it('запрашивает страницу по параметрам из URL и показывает облигации', async () => {
    const calls = mockFetch({ body: page([bond('RU000A1'), bond('RU000A2')], { totalElements: 120, page: 2 }) });

    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds?scope=local&page=3&sort=TICKER:DESC&risk=RISK_LEVEL_LOW' });

    expect(await screen.findByText('RU000A1')).toBeInTheDocument();
    expect(screen.getByText(/Найдено: 120/)).toBeInTheDocument();

    expect(calls[0]!.url).toBe('http://localhost:8080/internal/rest/bonds/local/page?page=2&size=50');
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
      bondSorts: [{ sortField: 'TICKER', sortOrder: 'DESC' }],
      riskLevels: ['RISK_LEVEL_LOW'],
    });
  });

  it('смена вкладки сбрасывает страницу и сохраняет фильтры в URL', async () => {
    mockFetch({ body: page([bond('RU000A1')]) });
    const { router } = renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds?page=4&ofz=only' });
    await screen.findByText('RU000A1');

    await userEvent.click(screen.getByRole('tab', { name: 'Валютные' }));

    expect(router.state.location.search).toBe('?scope=foreign&ofz=only');
  });

  it('показывает ошибку бэка', async () => {
    mockFetch({ status: 400, body: { title: 'Bad Request', detail: 'size must not exceed 500' } });

    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds' });

    expect(await screen.findByText('size must not exceed 500')).toBeInTheDocument();
  });
});

describe('BondPage', () => {
  it('показывает карточку облигации', async () => {
    const calls = mockFetch({ body: bond('RU000A10EQ34', { name: 'Авто Финанс Банк БО-001Р-18' }) });

    renderRoute(<BondPage />, { path: '/bonds/:ticker', url: '/bonds/RU000A10EQ34' });

    expect(await screen.findByRole('heading', { name: 'Авто Финанс Банк БО-001Р-18' })).toBeInTheDocument();
    expect(screen.getByText('12,5 % годовых')).toBeInTheDocument();
    expect(screen.getByText('График выплат ещё не загружен')).toBeInTheDocument();
    expect(calls[0]!.url).toBe('http://localhost:8080/internal/rest/bonds/RU000A10EQ34');
  });

  it('неизвестный тикер - 404', async () => {
    mockFetch({ status: 404, body: { title: 'Not Found', detail: 'Bond not found for ticker NOPE' } });

    renderRoute(<BondPage />, { path: '/bonds/:ticker', url: '/bonds/NOPE' });

    await waitFor(() => expect(screen.getByText('Облигация NOPE не найдена')).toBeInTheDocument());
  });
});
