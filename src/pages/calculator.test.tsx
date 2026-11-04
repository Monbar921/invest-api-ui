import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Bond, BondSearchItem, ProfitCalculation } from '../api/types';
import { renderRoute } from '../test/render';
import { BondPage } from './BondPage';
import { CalculatorPage } from './CalculatorPage';

const bond: Bond = {
  ticker: 'RU000A10DCK7',
  uid: 'uid-1',
  isin: 'RU000A10DCK7',
  name: 'АБЗ-1 002P-04',
  sector: 'industrials',
  price: {
    uid: null,
    nominal: { quantity: 1000, currency: 'rub' },
    current: { quantity: 1010.7, currency: 'rub' },
    currentInRub: 1010.7,
    percentagePrice: 101.07,
    aci: { quantity: 4.81, currency: 'rub' },
  },
  coupon: {
    uid: null,
    quantityPerYear: 12,
    interest: 18.25,
    isFixed: true,
    yieldToMaturity: 20.3,
    yieldToOffer: null,
    couponData: null,
  },
  riskLevel: 'RISK_LEVEL_LOW',
  maturityDate: '2030-10-16T00:00:00Z',
  offerDate: null,
  amortizationFlag: true,
};

const found: BondSearchItem = {
  ticker: bond.ticker,
  uid: bond.uid,
  isin: bond.isin,
  name: bond.name,
  sector: bond.sector,
  currency: 'rub',
  riskLevel: 'RISK_LEVEL_LOW',
  maturityDate: bond.maturityDate,
};

const calculation: ProfitCalculation = {
  ticker: bond.ticker,
  currency: 'rub',
  quantity: 1,
  buyDate: '2026-11-04',
  sellDate: '2030-10-16',
  days: 1442,
  exitType: 'MATURITY',
  buyPricePercent: 101.07,
  sellPricePercent: 100,
  purchaseAmount: 1010.7,
  purchaseAci: 4.81,
  couponIncome: 600,
  couponCount: 47,
  amortizationIncome: 1000,
  exitAmount: 0,
  exitAci: 0,
  profit: 584.49,
  profitPercent: 57.55,
  annualProfitPercent: 14.57,
  taxRatePercent: 13,
  tax: 75.98,
  netProfit: 508.51,
  netProfitPercent: 50.07,
  unknownCouponCount: 2,
  aciUnknown: false,
  amortizationScheduleMissing: false,
};

// Intl в ru-RU разделяет разряды неразрывным пробелом - сравниваем текст абзаца с обычными пробелами
const byText = (text: string) => (_: string, element: Element | null) =>
  element?.textContent?.replace(/\s/g, ' ') === text && element.children.length === 0;

/** Ответ на запрос выбирается по его URL: страница одновременно ищет, грузит облигацию и считает доход */
function mockApi() {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const body = url.includes('/search') ? [found] : url.endsWith('/calculation') ? calculation : bond;
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('CalculatorPage', () => {
  it('ищет облигацию по мере ввода и открывает выбранную', async () => {
    const calls = mockApi();
    const { router } = renderRoute(<CalculatorPage />, { path: '/calculator', url: '/calculator' });

    await userEvent.type(screen.getByPlaceholderText('Тикер, ISIN или название'), 'абз');
    await userEvent.click(await screen.findByText('АБЗ-1 002P-04'));

    // запрос уходит один раз - после паузы в наборе, а не на каждую букву
    expect(calls.filter((call) => call.url.includes('/search'))).toHaveLength(1);
    expect(calls[0]!.url).toBe(`/api/bonds/search?query=${encodeURIComponent('абз')}&limit=20`);
    await waitFor(() => expect(router.state.location.search).toBe('?ticker=RU000A10DCK7'));
  });

  it('показывает показатели облигации и результат расчёта', async () => {
    const calls = mockApi();
    renderRoute(<CalculatorPage />, { path: '/calculator', url: '/calculator?ticker=RU000A10DCK7' });

    expect(await screen.findByText(byText('584,49 ₽'))).toBeInTheDocument();
    expect(screen.getByText('Промышленность')).toBeInTheDocument();
    expect(screen.getByText('18,25 %')).toBeInTheDocument();
    expect(screen.getByText('постоянный, годовых к цене')).toBeInTheDocument();
    expect(screen.getByText('20,3 %')).toBeInTheDocument();
    expect(screen.getByText('оферты нет')).toBeInTheDocument();
    expect(screen.getByText(byText('75,98 ₽'))).toBeInTheDocument();
    expect(screen.getByText('НДФЛ 13 %')).toBeInTheDocument();
    expect(screen.getByText(/Размер 2 купонов ещё не объявлен/)).toBeInTheDocument();

    // по умолчанию: одна облигация, сегодня по текущей цене, держим до погашения
    const body = JSON.parse(String(calls.find((call) => call.url.endsWith('/calculation'))!.init?.body));
    expect(body).toMatchObject({ quantity: 1, sellDate: '2030-10-16', buyPricePercent: 101.07, taxRatePercent: 13 });
    expect(body.sellPricePercent).toBeUndefined();
  });

  it('ставка НДФЛ 15 % и расчёт без налога', async () => {
    const calls = mockApi();
    renderRoute(<CalculatorPage />, { path: '/calculator', url: '/calculator?ticker=RU000A10DCK7' });
    await screen.findByText(byText('584,49 ₽'));
    const lastBody = () => JSON.parse(String(calls.filter((call) => call.url.endsWith('/calculation')).at(-1)!.init?.body));

    await userEvent.click(screen.getByText('15 %'));
    await waitFor(() => expect(lastBody().taxRatePercent).toBe(15));

    await userEvent.click(screen.getByLabelText('Учитывать НДФЛ'));
    await waitFor(() => expect(lastBody().taxRatePercent).toBeUndefined());
  });

  it('без налога не показывает НДФЛ и доход после налога', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      const body = url.endsWith('/calculation') ? { ...calculation, taxRatePercent: null, tax: 0, netProfit: 584.49 } : bond;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    renderRoute(<CalculatorPage />, { path: '/calculator', url: '/calculator?ticker=RU000A10DCK7' });

    expect(await screen.findByText(byText('584,49 ₽'))).toBeInTheDocument();
    expect(screen.queryByText('Доход после налога')).not.toBeInTheDocument();
  });

  it('не считает с неверным периодом', async () => {
    const calls = mockApi();
    renderRoute(<CalculatorPage />, { path: '/calculator', url: '/calculator?ticker=RU000A10DCK7' });
    await screen.findByText(byText('584,49 ₽'));
    const before = calls.filter((call) => call.url.endsWith('/calculation')).length;

    fireEvent.change(screen.getByLabelText('Дата продажи'), { target: { value: '2020-01-01' } });

    expect(await screen.findByText('Позже даты покупки')).toBeInTheDocument();
    // пауза перед пересчётом прошла бы, но с ошибкой в форме запрос не уходит
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(calls.filter((call) => call.url.endsWith('/calculation'))).toHaveLength(before);
  });

  it('продажа раньше погашения - нужна цена продажи', async () => {
    const calls = mockApi();
    renderRoute(<CalculatorPage />, { path: '/calculator', url: '/calculator?ticker=RU000A10DCK7' });
    await screen.findByText(byText('584,49 ₽'));

    fireEvent.change(screen.getByLabelText('Дата продажи'), { target: { value: '2028-01-10' } });

    expect(screen.getByLabelText('Цена продажи, % номинала')).toBeEnabled();
    await waitFor(() =>
      expect(JSON.parse(String(calls.at(-1)!.init?.body))).toMatchObject({
        sellDate: '2028-01-10',
        sellPricePercent: 101.07,
      }),
    );
  });
});

describe('BondPage', () => {
  it('ведёт в калькулятор с выбранной облигацией', async () => {
    mockApi();
    renderRoute(<BondPage />, { path: '/bonds/:ticker', url: '/bonds/RU000A10DCK7' });

    const link = await screen.findByRole('link', { name: 'Рассчитать доход' });
    expect(link).toHaveAttribute('href', '/calculator?ticker=RU000A10DCK7');
  });
});
