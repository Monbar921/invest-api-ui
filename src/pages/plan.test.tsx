import { screen, within } from '@testing-library/react';
import type { AccountPlan, Plan } from '../api/types';
import { FREE_PLAN, mockFetchByUrl, renderRoute } from '../test/render';
import { PlanPage } from './PlanPage';

const PREMIUM: Plan = {
  id: 'premium',
  title: 'Премиум',
  description: 'Больше правил и покупок',
  paid: true,
  limits: { ALERTS: 500, PORTFOLIO_POSITIONS: 2000 },
  features: ['CALENDAR_ICS'],
};
const BASIC: Plan = {
  id: 'basic',
  title: 'Базовый',
  description: null,
  paid: true,
  limits: { ALERTS: 40, PORTFOLIO_POSITIONS: 200 },
  features: [],
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
    expect(screen.getByText(/Оплата появится позже/)).toBeInTheDocument();
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
});
