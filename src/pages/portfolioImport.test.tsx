import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccountPlan, BrokerConnection, Portfolio, PortfolioImport } from '../api/types';
import { FREE_PLAN, renderRoute } from '../test/render';
import { PortfolioPage } from './PortfolioPage';

const EMPTY_PORTFOLIO: Portfolio = { groups: [], totals: [], summary: null, closed: [], incomeTotals: [], income: null };

/** Тариф с импортом */
const IMPORT_PLAN: AccountPlan = {
  ...FREE_PLAN,
  plan: { ...FREE_PLAN.plan, id: 'premium', title: 'Премиум', paid: true, features: ['CALENDAR_ICS', 'BROKER_IMPORT'] },
};

const DISCONNECTED: BrokerConnection = {
  enabled: true,
  connected: false,
  tokenHint: null,
  connectedAt: null,
  lastImportAt: null,
  accounts: null,
};

const PREVIEW: PortfolioImport = {
  id: 7,
  source: 'CSV',
  fileName: 'deals.csv',
  status: 'PREVIEW',
  createdAt: '2026-11-14T10:00:00Z',
  appliedAt: null,
  skippedOperations: 0,
  warnings: [],
  counts: { NEW: 1, POSSIBLE_DUPLICATE: 1, UNKNOWN_BOND: 1 },
  items: [
    {
      id: 1,
      lineNo: 2,
      kind: 'BUY',
      date: '2026-10-01',
      ticker: 'SU26238RMFS4',
      isin: 'RU000A1038V6',
      figi: null,
      name: 'ОФЗ 26238',
      quantity: 10,
      price: 60.5,
      aci: 12.3,
      commission: 1.5,
      currency: 'rub',
      amountRub: null,
      broker: null,
      status: 'NEW',
      message: null,
      selectable: true,
      tradeId: null,
    },
    {
      id: 2,
      lineNo: 3,
      kind: 'BUY',
      date: '2026-10-02',
      ticker: 'RU000A10EQ34',
      isin: 'RU000A10EQ34',
      figi: null,
      name: 'Авто Финанс Банк БО-001Р-18',
      quantity: 5,
      price: 100,
      aci: null,
      commission: null,
      currency: 'rub',
      amountRub: null,
      broker: null,
      status: 'POSSIBLE_DUPLICATE',
      message: 'Похожая покупка уже введена вручную: та же облигация, дата и количество',
      selectable: true,
      tradeId: null,
    },
    {
      id: 3,
      lineNo: 4,
      kind: 'BUY',
      date: '2026-10-02',
      ticker: null,
      isin: 'RU000A0JX0J2',
      figi: null,
      name: null,
      quantity: 3,
      price: null,
      aci: null,
      commission: null,
      currency: 'rub',
      amountRub: null,
      broker: null,
      status: 'UNKNOWN_BOND',
      message: 'Облигации нет в системе - сделка не импортируется',
      selectable: false,
      tradeId: null,
    },
  ],
  unknownBonds: [{ isin: 'RU000A0JX0J2', figi: null, ticker: null, name: null, trades: 1 }],
};

const REPORT: PortfolioImport = {
  ...PREVIEW,
  status: 'APPLIED',
  appliedAt: '2026-11-14T10:01:00Z',
  counts: { CREATED: 1, SKIPPED: 1, UNKNOWN_BOND: 1 },
  items: [
    { ...PREVIEW.items![0]!, status: 'CREATED', tradeId: 101 },
    { ...PREVIEW.items![1]!, status: 'SKIPPED', message: 'Не выбрана' },
    PREVIEW.items![2]!,
  ],
};

/** API импорта: подключение, предпросмотр файла, подтверждение; запросы с телами складываются в calls */
function mockApi({ plan = IMPORT_PLAN, connection = DISCONNECTED } = {}) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  let state = connection;
  let applied = false;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body });
    let body: unknown = EMPTY_PORTFOLIO;
    if (url === '/api/account/plan') {
      body = plan;
    } else if (url === '/api/portfolio/imports/tinvest' && method === 'PUT') {
      state = { ...state, connected: true, tokenHint: 'XYZ9', connectedAt: '2026-11-14T10:00:00Z' };
      body = { ...state, accounts: [] };
    } else if (url === '/api/portfolio/imports/tinvest') {
      body = state;
    } else if (url === '/api/portfolio/imports/tinvest/accounts') {
      body = [{ id: '2000', name: 'Брокерский счёт', type: 'ACCOUNT_TYPE_TINKOFF', openedDate: null, closed: false }];
    } else if (url.startsWith('/api/portfolio/imports/file/preview')) {
      body = PREVIEW;
    } else if (url === '/api/portfolio/imports/7/apply') {
      applied = true;
      body = REPORT;
    } else if (url === '/api/portfolio/imports/7') {
      body = applied ? REPORT : PREVIEW;
    } else if (url === '/api/portfolio/brokers') {
      body = [
        { id: 1, name: 'ВТБ' },
        { id: 2, name: 'АльфаБанк' },
      ];
    } else if (url === '/api/portfolio/imports') {
      body = [];
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

const renderImport = () => renderRoute(<PortfolioPage />, { path: '/portfolio', url: '/portfolio?tab=import' });

afterEach(() => vi.unstubAllGlobals());

describe('PortfolioPage: импорт от брокера', () => {
  it('без импорта в тарифе - подсказка и закрытая форма', async () => {
    mockApi({ plan: FREE_PLAN });
    renderImport();

    expect(await screen.findByText(/Доступно в платном тарифе/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Токен T-Invest API')).toBeDisabled());
  });

  it('подключение токена: токен уходит один раз, дальше виден только хвост', async () => {
    const calls = mockApi();
    renderImport();

    await userEvent.type(await screen.findByLabelText('Токен T-Invest API'), 't.secret-XYZ9');
    await userEvent.click(screen.getByRole('button', { name: 'Подключить' }));

    const put = calls.find((call) => call.method === 'PUT');
    expect(JSON.parse(String(put?.body))).toEqual({ token: 't.secret-XYZ9' });
    expect(await screen.findByText(/Токен …XYZ9 подключён/)).toBeInTheDocument();
  });

  it('файл: предпросмотр с выбором, неизвестные облигации, отчёт', async () => {
    const calls = mockApi();
    const { container } = renderImport();

    await userEvent.click(await screen.findByText('Файл отчёта'));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['Дата;Операция'], 'deals.csv', { type: 'text/csv' }));
    await userEvent.click(screen.getByRole('button', { name: 'Загрузить' }));

    // предпросмотр: выбрана только новая сделка, неизвестная облигация названа
    expect(await screen.findByText('Облигаций нет в системе - их сделки не импортированы')).toBeInTheDocument();
    expect(screen.getByText(/ISIN RU000A0JX0J2/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Выбрать: ОФЗ 26238/)).toBeChecked();
    expect(screen.getByLabelText(/Выбрать: Авто Финанс Банк/)).not.toBeChecked();
    expect(screen.getByLabelText(/Выбрать: RU000A0JX0J2/)).toBeDisabled();
    // НКД и комиссия - с валютой номинала
    expect(screen.getByText(/^12,3/)).toHaveTextContent('₽');
    const upload = calls.find((call) => call.url.startsWith('/api/portfolio/imports/file/preview'));
    expect(upload?.url).toContain('format=CSV');
    // у своего CSV брокер по умолчанию не задан - берётся из столбца файла
    expect(upload?.url).not.toContain('broker=');
    expect(upload?.body).toBeInstanceOf(FormData);

    await userEvent.click(screen.getByRole('button', { name: 'Импортировать выбранные (1)' }));

    const apply = calls.find((call) => call.url === '/api/portfolio/imports/7/apply');
    expect(JSON.parse(String(apply?.body))).toEqual({ itemIds: [1] });
    const created = await screen.findByText('Создана');
    expect(within(created.closest('tr')!).getByText('ОФЗ 26238')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Новый импорт' })).toBeInTheDocument();
  });

  it('отчёт Альфа-Банка: брокер по умолчанию - уже заведённый с тем же именем', async () => {
    const calls = mockApi();
    const { container } = renderImport();

    await userEvent.click(await screen.findByText('Файл отчёта'));
    await userEvent.click(screen.getAllByLabelText('Формат')[0]!);
    await userEvent.click(await screen.findByRole('option', { name: 'Брокерский отчёт Альфа-Банка (Excel)', hidden: true }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(['xlsx'], 'alfa.xlsx'));
    await userEvent.click(screen.getByRole('button', { name: 'Загрузить' }));

    await screen.findByText('Облигаций нет в системе - их сделки не импортированы');
    const upload = calls.find((call) => call.url.startsWith('/api/portfolio/imports/file/preview'));
    expect(upload?.url).toContain('format=ALFA_XLSX');
    expect(decodeURIComponent(upload!.url)).toContain('broker=АльфаБанк');
  });

  it('импорт по токену выключен - сразу загрузка файла', async () => {
    mockApi({ connection: { ...DISCONNECTED, enabled: false } });
    renderImport();

    expect((await screen.findAllByLabelText('Формат'))[0]).toBeInTheDocument();
    expect(screen.queryByLabelText('Токен T-Invest API')).not.toBeInTheDocument();
  });
});
