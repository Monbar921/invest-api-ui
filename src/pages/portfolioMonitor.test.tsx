import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Alert } from '../api/types';
import { FREE_PLAN, renderRoute } from '../test/render';
import { AlertsPage } from './AlertsPage';

interface Call {
  url: string;
  method: string;
  body: unknown;
}

const digest = (overrides: Partial<Alert> = {}): Alert => ({
  id: 5,
  ticker: null,
  bondName: null,
  isin: null,
  type: 'PORTFOLIO_DIGEST',
  days: 7,
  direction: null,
  threshold: null,
  baseValue: null,
  state: null,
  enabled: true,
  createdAt: '2026-11-15T10:00:00Z',
  lastTriggeredAt: null,
  ...overrides,
});

/** fetch по адресу и методу; запросы к правилам складываются в calls */
function stubApi(alerts: Alert[]): Call[] {
  const calls: Call[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url.endsWith('/api/account/plan')) {
      return json(FREE_PLAN);
    }
    if (url.endsWith('/api/alerts/telegram')) {
      return json({ botEnabled: true, linked: true, username: null, available: true });
    }
    if (url.includes('/api/alerts/notifications')) {
      return json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    }
    if (url.includes('/api/alerts/filters')) {
      return json([]);
    }
    if (url.match(/\/api\/alerts(\/\d+)?$/)) {
      if (method === 'GET') {
        return json(alerts);
      }
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      return json(digest(body as Partial<Alert>), method === 'POST' ? 201 : 200);
    }
    return json([]);
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Монитор риска и дайджест на странице уведомлений', () => {
  it('включает монитор риска без облигации', async () => {
    const calls = stubApi([]);
    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts' });

    await userEvent.click(await screen.findByRole('switch', { name: 'Риски по облигациям портфеля' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: 'POST', body: { type: 'PORTFOLIO_RISK' } });
  });

  it('создаёт дайджест с выбранным периодом', async () => {
    const calls = stubApi([]);
    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts' });

    await screen.findByRole('switch', { name: 'Дайджест портфеля' });
    await userEvent.click(screen.getByText('Раз в день'));
    await userEvent.click(screen.getByRole('switch', { name: 'Дайджест портфеля' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ method: 'POST', body: { type: 'PORTFOLIO_DIGEST', days: 1 } });
  });

  it('меняет период включённого дайджеста сразу', async () => {
    const calls = stubApi([digest()]);
    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts' });

    // переключатель есть и до загрузки правил - ждём, пока он станет включённым
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Дайджест портфеля' })).toBeChecked());
    await userEvent.click(screen.getByText('Раз в день'));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.url).toMatch(/\/api\/alerts\/5$/);
    expect(calls[0]).toMatchObject({ method: 'PUT', body: { days: 1 } });
  });

  it('правила портфеля не попадают в список по облигациям', async () => {
    stubApi([digest(), digest({ id: 6, type: 'PORTFOLIO_RISK', days: null })]);
    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts' });

    expect(await screen.findByText(/Уведомлений пока нет/)).toBeInTheDocument();
  });
});
