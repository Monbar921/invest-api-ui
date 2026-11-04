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
    isFixed: true,
    yieldToMaturity: 14.25,
    yieldToOffer: null,
    couponData: null,
  },
  riskLevel: 'RISK_LEVEL_LOW',
  maturityDate: '2030-01-01T00:00:00Z',
  offerDate: null,
  amortizationFlag: false,
  ...overrides,
});

const usdBond = (ticker: string): Bond =>
  bond(ticker, {
    price: {
      uid: null,
      nominal: { quantity: 1000, currency: 'usd' },
      current: { quantity: 980, currency: 'usd' },
      currentInRub: 88200,
      percentagePrice: 98,
      aci: null,
    },
  });

// Intl в ru-RU разделяет разряды неразрывным пробелом - сравниваем текст абзаца с обычными пробелами
const byText = (text: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent?.replace(/\s/g, ' ') === text;

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

    expect(calls[0]!.url).toBe('/api/bonds/local/page?page=2&size=50');
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
      bondSorts: [{ sortField: 'TICKER', sortOrder: 'DESC' }],
      riskLevels: ['RISK_LEVEL_LOW'],
    });
  });

  it('цена в рублях, у облигации в валюте под ней цена в валюте', async () => {
    mockFetch({ body: page([bond('RU000A1'), usdBond('RU000A2')]) });

    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds' });
    await screen.findByText('RU000A1');

    expect(screen.getByText(byText('950,00 ₽'))).toBeInTheDocument();
    expect(screen.getByText(byText('88 200,00 ₽'))).toBeInTheDocument();
    expect(screen.getByText(byText('980,00 $'))).toBeInTheDocument();
    // у рублёвой облигации вторая строка не дублирует цену
    expect(screen.queryAllByText(byText('950,00 ₽'))).toHaveLength(1);
  });

  it('показывает доходность к погашению, а при оферте - и к оферте', async () => {
    const withOffer = bond('RU000A2', {
      offerDate: '2027-01-13T00:00:00Z',
      coupon: {
        uid: null,
        quantityPerYear: 4,
        interest: 10,
        isFixed: false,
        yieldToMaturity: 11.17,
        yieldToOffer: 12.24,
        couponData: null,
      },
    });
    mockFetch({ body: page([bond('RU000A1'), withOffer]) });

    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds' });
    await screen.findByText('RU000A1');

    expect(screen.getByText('14,25 %')).toBeInTheDocument();
    expect(screen.getByText('11,17 %')).toBeInTheDocument();
    expect(screen.getByText('12,24 %')).toBeInTheDocument();
    expect(screen.getByText('13.01.2027')).toBeInTheDocument();
    // тип купона - под купонной доходностью
    expect(screen.getByText('постоянный · 4 раза в год')).toBeInTheDocument();
    expect(screen.getByText('переменный · 4 раза в год')).toBeInTheDocument();
  });

  it.each([
    ['К погашению,', 'YIELD_TO_MATURITY'],
    ['К оферте,', 'YIELD_TO_OFFER'],
  ])('сортировка по колонке «%s»', async (title, sortField) => {
    const calls = mockFetch({ body: page([bond('RU000A1')]) });
    const { router } = renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds' });
    await screen.findByText('RU000A1');

    // заголовок разбит на две строки через <br> - ищем по первой
    await userEvent.click(
      screen.getByText((_, element) => element?.tagName !== 'TH' && element?.firstChild?.textContent?.trim() === title),
    );

    await waitFor(() => expect(router.state.location.search).toBe(`?sort=${sortField}%3AASC`));
    await waitFor(() =>
      expect(JSON.parse(String(calls.at(-1)!.init?.body)).bondSorts).toEqual([{ sortField, sortOrder: 'ASC' }]),
    );
  });

  it('фильтр по типу купона попадает в URL и в запрос', async () => {
    const calls = mockFetch({ body: page([bond('RU000A1')]) });
    const { router } = renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds' });
    await screen.findByText('RU000A1');

    await userEvent.click(screen.getByText('Переменный'));

    await waitFor(() => expect(router.state.location.search).toBe('?coupon=floating'));
    await waitFor(() => expect(JSON.parse(String(calls.at(-1)!.init?.body)).isFixedCoupon).toBe(false));
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
    expect(screen.getByText('12,5 % к цене')).toBeInTheDocument();
    expect(screen.getByText('постоянный · 4 выплаты в год')).toBeInTheDocument();
    expect(screen.getByText('14,25 % годовых')).toBeInTheDocument();
    expect(screen.getByText(byText('11,72 ₽'))).toBeInTheDocument();
    expect(screen.getByText('График выплат ещё не загружен')).toBeInTheDocument();
    expect(calls[0]!.url).toBe('/api/bonds/RU000A10EQ34');
  });

  it('у облигации в валюте показывает рублёвый эквивалент', async () => {
    mockFetch({ body: usdBond('RU000A105A95') });

    renderRoute(<BondPage />, { path: '/bonds/:ticker', url: '/bonds/RU000A105A95' });

    expect(await screen.findByText(byText('980,00 $'))).toBeInTheDocument();
    expect(screen.getByText(byText('≈ 88 200,00 ₽ · 98 % от номинала'))).toBeInTheDocument();
  });

  it('показывает оферту и амортизацию', async () => {
    mockFetch({
      body: bond('RU000A10EHB3', {
        offerDate: '2028-03-01T00:00:00Z',
        amortizationFlag: true,
        coupon: {
          uid: null,
          quantityPerYear: 4,
          interest: 10,
          isFixed: false,
          yieldToMaturity: 11.17,
          yieldToOffer: 12.24,
          couponData: null,
        },
      }),
    });

    renderRoute(<BondPage />, { path: '/bonds/:ticker', url: '/bonds/RU000A10EHB3' });

    expect(await screen.findByText('11,17 % годовых')).toBeInTheDocument();
    expect(screen.getByText('к оферте 12,24 % · 01.03.2028')).toBeInTheDocument();
    expect(screen.getByText('с амортизацией: гасится частями')).toBeInTheDocument();
  });

  it('неизвестный тикер - 404', async () => {
    mockFetch({ status: 404, body: { title: 'Not Found', detail: 'Bond not found for ticker NOPE' } });

    renderRoute(<BondPage />, { path: '/bonds/:ticker', url: '/bonds/NOPE' });

    await waitFor(() => expect(screen.getByText('Облигация NOPE не найдена')).toBeInTheDocument());
  });
});
