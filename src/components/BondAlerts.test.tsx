import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Alert, NotificationItem, TelegramStatus } from '../api/types';
import { AlertsPage } from '../pages/AlertsPage';
import { renderRoute } from '../test/render';
import { BondAlertsButton } from './BondAlertsButton';

const TICKER = 'RU000A10EQ34';

const alert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 1,
  ticker: TICKER,
  bondName: 'Авто Финанс Банк БО-001Р-18',
  isin: TICKER,
  type: 'COUPON_BEFORE',
  days: 3,
  direction: null,
  threshold: null,
  baseValue: null,
  state: null,
  enabled: true,
  createdAt: '2026-11-08T10:00:00Z',
  lastTriggeredAt: null,
  ...overrides,
});

const telegram: TelegramStatus = {
  enabled: true,
  botUsername: 'invest_bonds_bot',
  linked: true,
  username: 'alice',
  linkedAt: '2026-11-08T09:00:00Z',
  available: true,
  checkedAt: '2026-11-08T10:00:00Z',
};

const notification = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 1,
  alertId: 1,
  ticker: TICKER,
  text: 'Купон через 2 дня, 14.11.2026\nАвто Финанс Банк БО-001Р-18 (RU000A10EQ34)',
  status: 'SENT',
  attempts: 1,
  createdAt: '2026-11-12T06:00:00Z',
  sentAt: '2026-11-12T06:00:05Z',
  lastError: null,
  ...overrides,
});

const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** fetch по адресу и методу; правила берутся из alerts - мутации их меняют, как сервер */
function mockAlertsApi({
  alerts = [] as Alert[],
  telegramStatus = telegram,
  history = [] as NotificationItem[],
  bond = null as unknown,
} = {}) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  let current = [...alerts];

  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (bond != null && url.endsWith(`/api/bonds/${TICKER}`)) {
      return json(bond);
    }
    if (url.endsWith('/api/alerts/telegram')) {
      return json(telegramStatus);
    }
    if (url.includes('/api/alerts/notifications')) {
      return json({ content: history, page: 0, size: 20, totalElements: history.length, totalPages: 1 });
    }
    if (url.endsWith('/api/alerts') && method === 'POST') {
      const created = alert({ id: 100 + current.length, ticker: body.ticker ?? null, ...body });
      current = [...current, created];
      return json(created, 201);
    }
    const match = url.match(/\/api\/alerts\/(\d+)$/);
    if (match && method === 'PUT') {
      current = current.map((item) => (item.id === Number(match[1]) ? { ...item, ...body } : item));
      return json(current.find((item) => item.id === Number(match[1])));
    }
    if (match && method === 'DELETE') {
      current = current.filter((item) => item.id !== Number(match[1]));
      return json(null, 204);
    }
    if (url.endsWith('/api/alerts')) {
      return json(current);
    }
    return json({ title: 'Not Found' }, 404);
  });

  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('BondAlertsButton', () => {
  it('включает уведомление о купоне со значением по умолчанию', async () => {
    const calls = mockAlertsApi();
    renderRoute(<BondAlertsButton ticker={TICKER} name="Авто Финанс" />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: `Уведомления: ${TICKER}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Уведомления: Авто Финанс' });
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Купон' }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')).toEqual({
        method: 'POST',
        url: '/api/alerts',
        body: { ticker: TICKER, type: 'COUPON_BEFORE', days: 3 },
      }),
    );
    // после включения колокольчик залит
    expect(await screen.findByRole('button', { name: `Уведомления включены: ${TICKER}` })).toBeInTheDocument();
  });

  it('выключает правило, а не удаляет его', async () => {
    const calls = mockAlertsApi({ alerts: [alert({ type: 'OFFER_BEFORE', days: 14 })] });
    renderRoute(<BondAlertsButton ticker={TICKER} name={null} />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: `Уведомления включены: ${TICKER}` }));
    const offer = await screen.findByRole('switch', { name: 'Оферта' });
    expect(offer).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Оферта: за сколько дней' })).toHaveValue('14');
    await userEvent.click(offer);

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PUT')).toEqual({
        method: 'PUT',
        url: '/api/alerts/1',
        body: { enabled: false },
      }),
    );
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
  });

  it('предупреждает, что Telegram не подключён', async () => {
    mockAlertsApi({ telegramStatus: { ...telegram, linked: false } });
    renderRoute(<BondAlertsButton ticker={TICKER} name={null} />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: `Уведомления: ${TICKER}` }));

    expect(await screen.findByText(/Telegram не подключён - уведомления не придут/)).toBeInTheDocument();
  });
});

describe('BondAlertsButton: цена и доходность', () => {
  it('добавляет порог цены с направлением и значением', async () => {
    const calls = mockAlertsApi();
    renderRoute(<BondAlertsButton ticker={TICKER} name={null} />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: `Уведомления: ${TICKER}` }));
    // по умолчанию - «Цена, % от номинала», «опустится до», 95
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить' }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
        ticker: TICKER,
        type: 'PRICE_LEVEL',
        direction: 'DOWN',
        threshold: 95,
      }),
    );
  });

  it('показывает пороги понятным текстом и удаляет их', async () => {
    const calls = mockAlertsApi({
      alerts: [
        alert({ id: 5, type: 'PRICE_LEVEL', days: null, direction: 'DOWN', threshold: 95, state: 'TRIGGERED' }),
        alert({ id: 6, type: 'PRICE_DAILY_CHANGE', days: null, direction: 'ANY', threshold: 2.5 }),
        alert({ id: 7, type: 'YTM_LEVEL', days: null, direction: 'UP', threshold: 20 }),
      ],
    });
    renderRoute(<BondAlertsButton ticker={TICKER} name={null} />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: `Уведомления включены: ${TICKER}` }));

    expect(await screen.findByRole('switch', { name: 'Цена ≤ 95% номинала' })).toBeChecked();
    expect(screen.getByText('сработало, ждёт возврата за порог')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Цена за день ±2,5%' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Доходность к погашению ≥ 20% годовых' })).toBeInTheDocument();
    // правила по датам при этом выключены
    expect(screen.getByRole('switch', { name: 'Купон' })).not.toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить: Цена за день ±2,5%' }));
    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.url === '/api/alerts/6')).toBe(true));
  });
});

describe('BondAlertsButton: события и новости', () => {
  it('включает новости и рейтинги облигации без параметров', async () => {
    const calls = mockAlertsApi();
    renderRoute(<BondAlertsButton ticker={TICKER} name={null} />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: `Уведомления: ${TICKER}` }));
    await userEvent.click(await screen.findByRole('switch', { name: 'Новости' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Рейтинги эмитента' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Объявлен купон' }));

    await waitFor(() =>
      expect(calls.filter((call) => call.method === 'POST').map((call) => call.body)).toEqual([
        { ticker: TICKER, type: 'BOND_NEWS' },
        { ticker: TICKER, type: 'ISSUER_RATING' },
        { ticker: TICKER, type: 'FLOATER_COUPON' },
      ]),
    );
  });

  it('выключает правило по событию, не удаляя его', async () => {
    const calls = mockAlertsApi({ alerts: [alert({ id: 9, type: 'BOND_NEWS', days: null })] });
    renderRoute(<BondAlertsButton ticker={TICKER} name={null} />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: `Уведомления включены: ${TICKER}` }));
    await userEvent.click(await screen.findByRole('switch', { name: 'Новости' }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PUT')).toEqual({
        method: 'PUT',
        url: '/api/alerts/9',
        body: { enabled: false },
      }),
    );
  });
});

describe('AlertsPage', () => {
  it('включает решения ЦБ по ключевой ставке без облигации', async () => {
    const calls = mockAlertsApi({ alerts: [alert()] });
    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts' });

    await userEvent.click(await screen.findByRole('switch', { name: 'Решения Банка России по ключевой ставке' }));

    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ type: 'KEY_RATE' }));
    // правило без облигации не появляется карточкой облигации
    expect(await screen.findByRole('switch', { name: 'Решения Банка России по ключевой ставке' })).toBeChecked();
    expect(screen.getAllByRole('link', { name: 'Авто Финанс Банк БО-001Р-18' })).toHaveLength(1);
  });

  it('показывает правила по облигациям и историю', async () => {
    mockAlertsApi({
      alerts: [alert(), alert({ id: 2, type: 'MATURITY_BEFORE', days: 30, enabled: false })],
      history: [
        notification(),
        notification({ id: 2, status: 'FAILED', sentAt: null, lastError: 'Telegram не подключён', text: 'Оферта завтра' }),
      ],
    });

    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts' });

    expect(await screen.findByRole('link', { name: 'Авто Финанс Банк БО-001Р-18' })).toHaveAttribute('href', `/bonds/${TICKER}`);
    // кратко, текстом; выключенное - с пометкой
    expect(screen.getByText('Купон за 3 дн.')).toBeInTheDocument();
    expect(screen.getByText('Погашение за 30 дн. (выкл.)')).toBeInTheDocument();
    expect(await screen.findByText(/Купон через 2 дня/)).toBeInTheDocument();
    expect(screen.getByText('Отправлено')).toBeInTheDocument();
    expect(screen.getByText('Не отправлено')).toBeInTheDocument();
    expect(screen.getByText('Telegram не подключён')).toBeInTheDocument();
  });

  it('удаляет все уведомления облигации', async () => {
    const calls = mockAlertsApi({ alerts: [alert(), alert({ id: 2, type: 'MATURITY_BEFORE' })] });
    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts' });

    await userEvent.click(await screen.findByRole('button', { name: `Удалить уведомления: ${TICKER}` }));
    // без подтверждения ничего не удаляется
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }));

    await waitFor(() =>
      expect(calls.filter((call) => call.method === 'DELETE').map((call) => call.url)).toEqual([
        '/api/alerts/1',
        '/api/alerts/2',
      ]),
    );
    expect(await screen.findByText(/Уведомлений пока нет/)).toBeInTheDocument();
  });

  it('настраивает облигацию в окне', async () => {
    mockAlertsApi({ alerts: [alert()] });
    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts' });

    await userEvent.click(await screen.findByRole('button', { name: 'Настроить' }));

    expect(await screen.findByRole('switch', { name: 'Купон' })).toBeChecked();
  });
});

describe('BondAlertsButton: проверки формы порога', () => {
  it('не создаёт правило с порогом вне пределов и показывает ошибку', async () => {
    const calls = mockAlertsApi();
    renderRoute(<BondAlertsButton ticker={TICKER} name={null} />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: `Уведомления: ${TICKER}` }));
    const threshold = await screen.findByRole('textbox', { name: 'Порог, %' });
    await userEvent.clear(threshold);
    await userEvent.type(threshold, '500');
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    // 500 не подрезается до 300: ошибка у поля, запроса нет
    expect(threshold).toHaveValue('500');
    expect(screen.getByText('от 1 до 300')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });
});

describe('BondAlertsButton: подсказки по облигации', () => {
  const fixedBond = {
    ticker: TICKER,
    name: 'Авто Финанс',
    price: { percentagePrice: 51.71 },
    coupon: { isFixed: true, yieldToMaturity: 16.18, yieldToOffer: null },
    offerDate: null,
  };

  it('скрывает неприменимые правила и предупреждает о сработавшем условии', async () => {
    mockAlertsApi({ bond: fixedBond });
    renderRoute(<BondAlertsButton ticker={TICKER} name={null} />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: `Уведомления: ${TICKER}` }));

    // постоянный купон - «Объявлен купон» не нужен
    await waitFor(() => expect(screen.queryByRole('switch', { name: 'Объявлен купон' })).not.toBeInTheDocument());
    expect(screen.getByRole('switch', { name: 'Новости' })).toBeInTheDocument();
    // по умолчанию «опустится до 95» при цене 51,71% - сработает сразу
    expect(await screen.findByText(/Условие уже выполнено/)).toBeInTheDocument();
    // без оферты нет «Доходность к оферте»
    await userEvent.click(screen.getAllByLabelText('Уведомить, когда')[0]!);
    expect(screen.queryByRole('option', { name: 'Доходность к оферте', hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Доходность к погашению', hidden: true })).toBeInTheDocument();
  });
});
