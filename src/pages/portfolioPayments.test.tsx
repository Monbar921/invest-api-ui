import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccountPlan, CalendarLink, Plan, Portfolio, PortfolioCalendar, PortfolioCalendarEvent } from '../api/types';
import { enableAnalytics, sentGoals } from '../test/analytics';
import { FREE_PLAN, renderRoute } from '../test/render';
import { PortfolioPage } from './PortfolioPage';

const event = (overrides: Partial<PortfolioCalendarEvent>): PortfolioCalendarEvent => ({
  date: '2026-12-14',
  type: 'COUPON',
  ticker: 'SU26238RMFS4',
  bondName: 'ОФЗ 26238',
  currency: 'rub',
  quantity: 5,
  amountPerBond: 35.15,
  amount: 175.75,
  amountInRub: 175.75,
  amountUnknown: false,
  previousAmountPerBond: null,
  ...overrides,
});

const calendar: PortfolioCalendar = {
  from: '2026-11-12',
  to: '2027-11-12',
  events: [
    event({}),
    event({
      date: '2026-12-20',
      ticker: 'RU000A105A95',
      bondName: 'Газпром капитал ЗО28-1-Д',
      currency: 'usd',
      quantity: 1,
      amountPerBond: 31,
      amount: 31,
      amountInRub: 2790,
    }),
    event({
      date: '2027-01-15',
      ticker: 'RU000A10EHC1',
      bondName: 'Гидромашсервис 002Р-01',
      quantity: 4,
      amountPerBond: null,
      amount: null,
      amountInRub: null,
      amountUnknown: true,
    }),
    event({
      date: '2027-01-20',
      type: 'OFFER',
      ticker: 'RU000A1080Y2',
      bondName: 'Пушкинское ПЗ 001Р-03',
      amountPerBond: null,
      amount: null,
      amountInRub: null,
    }),
  ],
  months: [
    {
      month: '2026-12',
      totals: [
        { currency: 'rub', amount: 175.75, amountInRub: 175.75, incomplete: false },
        { currency: 'usd', amount: 31, amountInRub: 2790, incomplete: false },
      ],
      amountInRub: 2965.75,
      incomplete: false,
    },
    {
      month: '2027-01',
      totals: [{ currency: 'rub', amount: 0, amountInRub: 0, incomplete: true }],
      amountInRub: 0,
      incomplete: true,
    },
  ],
  totals: [
    { currency: 'rub', amount: 175.75, amountInRub: 175.75, incomplete: true },
    { currency: 'usd', amount: 31, amountInRub: 2790, incomplete: false },
  ],
  amountInRub: 2965.75,
  incomplete: true,
  unknownTickers: [],
};

const EMPTY_PORTFOLIO: Portfolio = { groups: [], totals: [], summary: null };
const TOKEN = 'secret_TOKEN-1';

const PREMIUM: Plan = {
  id: 'premium',
  title: 'Премиум',
  description: null,
  paid: true,
  limits: { ALERTS: 500, PORTFOLIO_POSITIONS: 2000 },
  features: ['CALENDAR_ICS'],
};

/** Тариф без подписки на календарь */
const BASIC_PLAN: AccountPlan = {
  ...FREE_PLAN,
  plan: { ...FREE_PLAN.plan, id: 'basic', title: 'Базовый', features: [] },
  plans: [{ ...FREE_PLAN.plan, id: 'basic', title: 'Базовый', features: [] }, PREMIUM],
};

// Intl в ru-RU разделяет разряды неразрывным пробелом - сравниваем текст с обычными пробелами
const byText = (text: string) => (_: string, element: Element | null) =>
  element?.textContent?.replace(/\s/g, ' ') === text && element.children.length === 0;

/**
 * API портфеля: календарь, состояние ссылки и её создание / отключение, тариф. createProblem - создание ссылки
 * отвечает 402 с этим телом
 */
function mockApi({
  current = calendar,
  link = { enabled: false, token: null, createdAt: null } as CalendarLink,
  plan = FREE_PLAN,
  createProblem = undefined as object | undefined,
} = {}) {
  const calls: { url: string; method: string }[] = [];
  let linkState = link;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method });
    let body: unknown = EMPTY_PORTFOLIO;
    if (url.startsWith('/api/portfolio/calendar/link')) {
      if (method === 'DELETE') {
        linkState = { enabled: false, token: null, createdAt: null };
        return new Response(null, { status: 204 });
      }
      if (method === 'POST' && createProblem) {
        return new Response(JSON.stringify(createProblem), {
          status: 402,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (method === 'POST') {
        linkState = { enabled: true, token: null, createdAt: '2026-11-12T10:00:00Z' };
        body = { enabled: true, token: TOKEN, createdAt: '2026-11-12T10:00:00Z' };
      } else {
        body = linkState;
      }
    } else if (url.startsWith('/api/portfolio/calendar')) {
      body = current;
    } else if (url === '/api/account/plan') {
      body = plan;
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

const renderPayments = () => renderRoute(<PortfolioPage />, { path: '/portfolio', url: '/portfolio?tab=payments' });

afterEach(() => vi.unstubAllGlobals());

describe('PortfolioPage: выплаты', () => {
  it('календарь не запрашивается, пока вкладка не открыта', async () => {
    const calls = mockApi();
    renderRoute(<PortfolioPage />, { path: '/portfolio', url: '/portfolio' });

    expect(await screen.findByText(/В портфеле пока ничего нет/)).toBeInTheDocument();
    expect(calls.some((call) => call.url.includes('/calendar'))).toBe(false);

    await userEvent.click(screen.getByRole('tab', { name: 'Выплаты' }));

    expect(await screen.findByText('Придёт за период, в рублях')).toBeInTheDocument();
    expect(calls.some((call) => /\/api\/portfolio\/calendar\?to=\d{4}-\d{2}-\d{2}$/.test(call.url))).toBe(true);
  });

  it('показывает итог, суммы на количество и неполный итог', async () => {
    mockApi();
    renderPayments();

    // итог неполный - «от»
    expect(await screen.findByText(byText('от 2 965,75 ₽'))).toBeInTheDocument();
    expect(screen.getByText('Итог неполный')).toBeInTheDocument();
    expect(screen.getByText(/Размер 1 выплаты ещё не объявлен/)).toBeInTheDocument();

    const ofzRow = screen.getByRole('link', { name: 'ОФЗ 26238' }).closest('tr')!;
    expect(within(ofzRow).getByText(byText('35,15 ₽'))).toBeInTheDocument();
    expect(within(ofzRow).getByText(byText('175,75 ₽'))).toBeInTheDocument();

    // валютная выплата - в валюте и в рублях
    const usdRow = screen.getByRole('link', { name: 'Газпром капитал ЗО28-1-Д' }).closest('tr')!;
    expect(within(usdRow).getByText(byText('2 790,00 ₽'))).toBeInTheDocument();

    const floaterRow = screen.getByRole('link', { name: 'Гидромашсервис 002Р-01' }).closest('tr')!;
    expect(within(floaterRow).getAllByText('не объявлен')).toHaveLength(2);

    // заголовки месяцев с их итогами: заглавная только первая буква, «г.» строчная
    expect(screen.getByText('Декабрь 2026 г.')).toBeInTheDocument();
    expect(screen.getByText('Январь 2027 г.')).toBeInTheDocument();
  });

  it('облигации, которых нет в системе, названы', async () => {
    mockApi({ current: { ...calendar, unknownTickers: ['GONE'] } });
    renderPayments();

    expect(await screen.findByText(/Облигаций GONE больше нет в системе/)).toBeInTheDocument();
  });

  it('пустой период', async () => {
    mockApi({
      current: { ...calendar, events: [], months: [], totals: [], amountInRub: 0, incomplete: false },
    });
    renderPayments();

    expect(await screen.findByText(/За выбранный период выплат/)).toBeInTheDocument();
  });

  it('смена периода запрашивает календарь до новой даты', async () => {
    const calls = mockApi();
    renderPayments();
    await screen.findByText('Придёт за период, в рублях');

    await userEvent.click(screen.getByText('3 мес'));

    await waitFor(() => expect(calls.filter((call) => call.url.startsWith('/api/portfolio/calendar?')).length).toBe(2));
  });

  it('ссылка на календарь: создание показывает адрес один раз, отключение - с подтверждением', async () => {
    const ym = enableAnalytics();
    const calls = mockApi();
    renderPayments();

    await userEvent.click(await screen.findByRole('button', { name: 'Создать ссылку' }));

    const input = await screen.findByLabelText('Адрес для подписки');
    expect(input).toHaveValue(`${window.location.origin}/api/calendar/${TOKEN}.ics`);
    expect(sentGoals(ym)).toContainEqual(['portfolio_calendar_link_created', undefined]);

    await userEvent.click(await screen.findByRole('button', { name: 'Отключить ссылку' }));
    expect(await screen.findByText(/перестанут обновляться/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Отключить' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE')).toBe(true));
    expect(await screen.findByRole('button', { name: 'Создать ссылку' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Адрес для подписки')).not.toBeInTheDocument();
  });

  it('у созданной ранее ссылки адреса нет - предлагается новая', async () => {
    mockApi({ link: { enabled: true, token: null, createdAt: '2026-11-01T09:00:00Z' } });
    renderPayments();

    expect(await screen.findByText(/Её адрес показывался один раз/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Новая ссылка' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Адрес для подписки')).not.toBeInTheDocument();
  });
  it('подписка на календарь не входит в тариф - вместо кнопки подсказка с тарифом, где она есть', async () => {
    const calls = mockApi({ plan: BASIC_PLAN });
    renderPayments();

    expect(await screen.findByText(/Доступно в платном тарифе «Премиум»/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Тарифы' })).toHaveAttribute('href', '/plan');
    expect(screen.queryByRole('button', { name: 'Создать ссылку' })).not.toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('ссылка, созданная на прошлом тарифе, не обновляется - её можно только отключить', async () => {
    mockApi({ plan: BASIC_PLAN, link: { enabled: true, token: null, createdAt: '2026-11-01T09:00:00Z' } });
    renderPayments();

    expect(await screen.findByText(/ссылка сохранена, но календарь по ней не обновляется/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отключить ссылку' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Новая ссылка' })).not.toBeInTheDocument();
  });

  it('402 при создании ссылки - сообщение бэка и ссылка на тарифы', async () => {
    mockApi({
      createProblem: {
        status: 402,
        detail: 'Подписка на календарь выплат не входит в тариф «Бесплатный».',
        plan: 'free',
        feature: 'CALENDAR_ICS',
      },
    });
    renderPayments();

    await userEvent.click(await screen.findByRole('button', { name: 'Создать ссылку' }));

    expect(await screen.findByText(/не входит в тариф «Бесплатный»/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Тарифы' })).toHaveAttribute('href', '/plan');
  });
});
