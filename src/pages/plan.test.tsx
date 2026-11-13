import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccountPlan, Payment, Plan } from '../api/types';
import { FREE_PLAN, mockFetchByUrl, renderRoute } from '../test/render';
import { PlanPage } from './PlanPage';

const PREMIUM: Plan = {
  id: 'premium',
  title: 'Премиум',
  description: 'Больше правил и покупок',
  paid: true,
  limits: { ALERTS: 500, PORTFOLIO_POSITIONS: 2000 },
  features: ['CALENDAR_ICS'],
  price: null,
  period: null,
  periodTitle: null,
  purchasable: false,
};
const BASIC: Plan = {
  id: 'basic',
  title: 'Базовый',
  description: null,
  paid: true,
  limits: { ALERTS: 40, PORTFOLIO_POSITIONS: 200 },
  features: [],
  price: null,
  period: null,
  periodTitle: null,
  purchasable: false,
};

const renderPlan = (session?: { authenticated: boolean; username: string | null }) =>
  renderRoute(<PlanPage />, { path: '/plan', url: '/plan', session });

afterEach(() => vi.unstubAllGlobals());

describe('PlanPage', () => {
  it('гость видит предложение войти и ничего не запрашивает', async () => {
    const calls = mockFetchByUrl([]);
    renderPlan({ authenticated: false, username: null });

    expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(calls.some((url) => url.includes('/api/account'))).toBe(false);
  });

  it('тариф по умолчанию: использование лимитов и сравнение тарифов', async () => {
    const account: AccountPlan = {
      ...FREE_PLAN,
      limits: [
        { limit: 'ALERTS', max: 50, used: 50 },
        { limit: 'PORTFOLIO_POSITIONS', max: 200, used: 12 },
      ],
      plans: [FREE_PLAN.plan, BASIC, PREMIUM],
    };
    mockFetchByUrl([[/\/api\/account\/plan$/, account]]);
    renderPlan();

    expect(await screen.findByText('Тариф по умолчанию - действует всегда.')).toBeInTheDocument();
    expect(screen.getByText('50 из 50')).toBeInTheDocument();
    expect(screen.getByText('Лимит исчерпан.')).toBeInTheDocument();
    expect(screen.getByText('12 из 200')).toBeInTheDocument();

    const table = screen.getByRole('table');
    const header = within(table).getAllByRole('columnheader');
    expect(header.map((cell) => cell.textContent)).toEqual(['', 'Бесплатныйваш', 'Базовый', 'Премиум']);
    const alerts = within(table).getByText('Правила уведомлений').closest('tr')!;
    expect(
      within(alerts)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Правила уведомлений', '50', '40', '500']);
    const calendar = within(table)
      .getByText(/Подписка на календарь/)
      .closest('tr')!;
    expect(within(calendar).getAllByLabelText('входит')).toHaveLength(2);
    expect(within(calendar).getAllByLabelText('не входит')).toHaveLength(1);
    expect(screen.getByText(/Оплата пока недоступна/)).toBeInTheDocument();
  });

  it('выданный тариф: срок и данные сверх лимита после смены тарифа', async () => {
    const account: AccountPlan = {
      plan: BASIC,
      defaultPlan: false,
      source: 'MANUAL',
      validUntil: '2027-01-31',
      limits: [
        { limit: 'ALERTS', max: 40, used: 45 },
        { limit: 'PORTFOLIO_POSITIONS', max: 200, used: 0 },
      ],
      plans: [FREE_PLAN.plan, BASIC],
      payments: FREE_PLAN.payments,
    };
    mockFetchByUrl([[/\/api\/account\/plan$/, account]]);
    renderPlan();

    expect(await screen.findByText('Действует по 31.01.2027 включительно.')).toBeInTheDocument();
    expect(screen.getByText('платный')).toBeInTheDocument();
    expect(screen.getByText('45 из 40')).toBeInTheDocument();
    expect(screen.getByText('Созданное раньше сохранено, новые добавить нельзя.')).toBeInTheDocument();
  });

  it('бессрочный тариф', async () => {
    mockFetchByUrl([
      [/\/api\/account\/plan$/, { ...FREE_PLAN, plan: PREMIUM, defaultPlan: false, source: 'MANUAL', plans: [PREMIUM] }],
    ]);
    renderPlan();

    expect(await screen.findByText('Действует бессрочно.')).toBeInTheDocument();
    expect(screen.getByText('Больше правил и покупок')).toBeInTheDocument();
  });

  describe('оплата', () => {
    const SOLD: Plan = { ...PREMIUM, price: 299, period: 'P1M', periodTitle: '1 месяц', purchasable: true };
    const PAYMENTS = {
      enabled: true,
      offerUrl: 'https://invest.test/offer',
      privacyUrl: 'https://invest.test/privacy',
      autoRenewal: null,
    };
    const PAYMENT: Payment = {
      id: 7,
      plan: 'premium',
      planTitle: 'Премиум',
      period: 'P1M',
      periodTitle: '1 месяц',
      amount: 299,
      kind: 'PURCHASE',
      status: 'PENDING',
      cardPan: null,
      errorMessage: null,
      confirmationUrl: 'https://securepay.test/new/7',
      createdAt: '2026-11-13T10:00:00Z',
      paidAt: null,
    };

    /** fetch по методу и адресу: [метод, шаблон, ответ или функция ответа] */
    function stubFetch(routes: [string, RegExp, unknown][]) {
      const calls: { method: string; url: string; body?: string }[] = [];
      vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        calls.push({ method, url, body: init?.body as string | undefined });
        if (method === 'DELETE') {
          return new Response(null, { status: 204 });
        }
        const route = routes.find(([routeMethod, pattern]) => routeMethod === method && pattern.test(url));
        const body = typeof route?.[2] === 'function' ? (route[2] as () => unknown)() : route?.[2];
        return new Response(JSON.stringify(route ? body : { title: 'Not Found' }), {
          status: route ? 200 : 404,
          headers: { 'Content-Type': 'application/json' },
        });
      });
      return calls;
    }

    it('цена в сравнении и покупка только с согласием на оферту и политику', async () => {
      const assign = vi.fn();
      vi.stubGlobal('location', { ...window.location, assign });
      const calls = stubFetch([
        ['GET', /\/api\/account\/plan$/, { ...FREE_PLAN, plans: [FREE_PLAN.plan, BASIC, SOLD], payments: PAYMENTS }],
        ['GET', /\/api\/account\/payments$/, []],
        ['POST', /\/api\/account\/payments$/, PAYMENT],
      ]);
      renderPlan();

      const table = await screen.findByRole('table');
      const price = within(table).getByText('Цена').closest('tr')!;
      expect(
        within(price)
          .getAllByRole('cell')
          .map((cell) => cell.textContent?.replace(/\s/g, ' ')),
      ).toEqual(['Цена', 'бесплатно', 'по запросу', '299 ₽ за 1 месяц']);
      // купить можно только тариф с ценой
      expect(within(table).getAllByRole('button', { name: 'Купить' })).toHaveLength(1);
      expect(screen.queryByText(/Оплата пока недоступна/)).not.toBeInTheDocument();

      await userEvent.click(within(table).getByRole('button', { name: 'Купить' }));
      const pay = await screen.findByRole('button', { name: 'Перейти к оплате' });
      expect(pay).toBeDisabled();
      expect(screen.getByRole('link', { name: 'оферты' })).toHaveAttribute('href', 'https://invest.test/offer');
      expect(screen.getByRole('link', { name: 'политики обработки персональных данных' })).toHaveAttribute(
        'href',
        'https://invest.test/privacy',
      );

      await userEvent.click(screen.getByRole('checkbox'));
      await userEvent.click(pay);

      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://securepay.test/new/7'));
      const purchase = calls.find((call) => call.method === 'POST')!;
      expect(JSON.parse(purchase.body!)).toEqual({ plan: 'premium' });
    });

    it('действующий оплаченный тариф: продление, история, отключение автопродления', async () => {
      const account: AccountPlan = {
        ...FREE_PLAN,
        plan: SOLD,
        defaultPlan: false,
        source: 'PAYMENT',
        validUntil: '2026-12-13',
        plans: [FREE_PLAN.plan, SOLD],
        payments: {
          ...PAYMENTS,
          autoRenewal: {
            plan: 'premium',
            planTitle: 'Премиум',
            cardPan: '430000******0777',
            nextChargeDate: '2026-12-13',
            amount: 299,
          },
        },
      };
      const paid: Payment = {
        ...PAYMENT,
        status: 'SUCCEEDED',
        confirmationUrl: null,
        cardPan: '430000******0777',
        paidAt: '2026-11-13T10:01:00Z',
      };
      const calls = stubFetch([
        ['GET', /\/api\/account\/plan$/, account],
        ['GET', /\/api\/account\/payments$/, [paid]],
      ]);
      renderPlan();

      expect(await screen.findByText(/Автопродление: 299\s₽ спишется 13\.12\.2026 с карты •••• 0777/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Продлить' })).toBeInTheDocument();
      expect(await screen.findByText('История платежей')).toBeInTheDocument();
      expect(screen.getByText('оплачен')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Отключить автопродление' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Отключить' }));

      await waitFor(() =>
        expect(calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/api/account/auto-renewal'))).toBe(true),
      );
    });

    it('возврат с оплаты: ждём подтверждение, затем «Оплата прошла»', async () => {
      let polls = 0;
      stubFetch([
        ['GET', /\/api\/account\/plan$/, FREE_PLAN],
        ['GET', /\/api\/account\/payments$/, []],
        [
          'GET',
          /\/api\/account\/payments\/7$/,
          () => (++polls < 2 ? PAYMENT : { ...PAYMENT, status: 'SUCCEEDED', confirmationUrl: null }),
        ],
      ]);
      renderRoute(<PlanPage />, { path: '/plan', url: '/plan?payment=7' });

      expect(await screen.findByText('Ждём подтверждение оплаты')).toBeInTheDocument();
      expect(await screen.findByText('Оплата прошла', {}, { timeout: 5000 })).toBeInTheDocument();
      expect(screen.getByText('Тариф «Премиум» подключён.')).toBeInTheDocument();
    });

    it('возврат с отказом: тариф не изменился', async () => {
      stubFetch([
        ['GET', /\/api\/account\/plan$/, FREE_PLAN],
        ['GET', /\/api\/account\/payments$/, []],
        ['GET', /\/api\/account\/payments\/7$/, { ...PAYMENT, status: 'FAILED', errorMessage: 'Недостаточно средств' }],
      ]);
      renderRoute(<PlanPage />, { path: '/plan', url: '/plan?payment=7' });

      expect(await screen.findByText('Оплата не прошла')).toBeInTheDocument();
      expect(screen.getByText(/Недостаточно средств\. Тариф не изменился/)).toBeInTheDocument();
    });
  });
});
