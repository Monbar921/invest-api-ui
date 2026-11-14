import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GUEST } from '../api/session';
import type { SavedFilter } from '../api/types';
import { fromBondParameters, parseBondSearch, toBondParameters } from '../lib/bondSearchParams';
import { EMPTY_NEWS_PAGE, FREE_PLAN, renderRoute } from '../test/render';
import { AlertsPage } from './AlertsPage';
import { BondsPage } from './BondsPage';

const EMPTY_PAGE = { content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 };

const saved = (overrides: Partial<SavedFilter> = {}): SavedFilter => ({
  id: 7,
  name: 'Доходные',
  scope: 'LOCAL',
  // так отдаёт бэк: незаданные поля - null
  parameters: {
    bondSorts: [{ sortField: 'YIELD_TO_MATURITY', sortOrder: 'DESC' }],
    yieldToMaturity: { min: 20, max: null as unknown as undefined },
    isOfz: false,
    riskLevels: null as unknown as undefined,
  },
  notify: true,
  alertId: 3,
  matches: 12,
  createdAt: '2026-11-14T10:00:00Z',
  updatedAt: '2026-11-14T10:00:00Z',
  ...overrides,
});

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/** fetch по адресу и методу; запросы к фильтрам складываются в calls */
function stubApi(filters: SavedFilter[]): Call[] {
  const calls: Call[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url.includes('/api/alerts/filters')) {
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (method === 'GET') {
        return json(filters);
      }
      if (method === 'POST') {
        return json(saved({ id: 8, ...(JSON.parse(String(init?.body)) as Partial<SavedFilter>) }), 201);
      }
      return json(saved({ notify: false, alertId: null }));
    }
    if (url.includes('/page')) {
      return json(EMPTY_PAGE);
    }
    if (url.includes('/news')) {
      return json(EMPTY_NEWS_PAGE);
    }
    if (url.endsWith('/api/account/plan')) {
      return json(FREE_PLAN);
    }
    if (url.endsWith('/api/alerts/telegram')) {
      return json({ botEnabled: true, linked: true, username: null, available: true });
    }
    if (url.includes('/api/alerts/notifications')) {
      return json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
    }
    if (url.includes('market-overview')) {
      return json({ keyRate: null, currencies: [] });
    }
    return json([]);
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Сохранённые фильтры', () => {
  it('параметры фильтра восстанавливают состояние таблицы', () => {
    const state = parseBondSearch(
      new URLSearchParams(
        'scope=local&sort=SPREAD_TO_OFZ:DESC&percentMax=101&risk=RISK_LEVEL_LOW&ofz=exclude&coupon=floating' +
          '&sector=financial&yearsMax=3&freq=4,12&offer=without&amort=with&ratingMin=A-&durMax=2&ytmMin=18' +
          '&turnoverMin=1000000&spreadMin=2',
      ),
    );

    expect(fromBondParameters('local', toBondParameters(state))).toEqual({ ...state, page: 1 });
    // null с бэка - как незаданное
    expect(fromBondParameters('all', saved().parameters)).toMatchObject({
      sortField: 'YIELD_TO_MATURITY',
      sortOrder: 'DESC',
      ytmMin: 20,
      ytmMax: undefined,
      ofz: 'exclude',
      riskLevels: [],
    });
  });

  it('открывает сохранённый фильтр из меню над таблицей', async () => {
    stubApi([saved()]);
    const { router } = renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: 'Мои фильтры' }));
    await userEvent.click(await screen.findByText('Доходные'));

    await waitFor(() => expect(router.state.location.search).toContain('ytmMin=20'));
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get('scope')).toBe('local');
    expect(params.get('sort')).toBe('YIELD_TO_MATURITY:DESC');
    expect(params.get('ofz')).toBe('exclude');
    // открытый фильтр назван на кнопке
    expect(await screen.findByRole('button', { name: 'Доходные' })).toBeInTheDocument();
  });

  it('сохраняет текущий фильтр с уведомлением', async () => {
    const calls = stubApi([]);
    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds?scope=foreign&ytmMin=15' });

    await userEvent.click(await screen.findByRole('button', { name: 'Мои фильтры' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Сохранить текущий фильтр' }));
    await userEvent.type(await screen.findByLabelText(/Название/), ' Валютные 15+ ');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true));
    const post = calls.find((call) => call.method === 'POST')!;
    expect(post.body).toMatchObject({
      name: 'Валютные 15+',
      scope: 'FOREIGN',
      notify: true,
      parameters: { yieldToMaturity: { min: 15 } },
    });
  });

  it('гостю меню фильтров не показывается', async () => {
    stubApi([saved()]);
    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds', session: GUEST });

    expect(await screen.findByText('Облигации')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Мои фильтры' })).not.toBeInTheDocument();
  });

  it('на странице уведомлений выключает уведомления по фильтру', async () => {
    const calls = stubApi([saved()]);
    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts' });

    expect(await screen.findByRole('link', { name: 'Доходные' })).toHaveAttribute('href', expect.stringContaining('ytmMin=20'));
    expect(screen.getByText('в выборке 12')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Уведомлять о новых облигациях: Доходные' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.method === 'PUT')!;
    expect(put.url).toMatch(/\/api\/alerts\/filters\/7$/);
    expect(put.body).toEqual({ notify: false });
  });
});
