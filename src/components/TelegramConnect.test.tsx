import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TelegramStatus } from '../api/types';
import { enableAnalytics, sentGoals } from '../test/analytics';
import { mockFetch, renderRoute } from '../test/render';
import { TelegramConnect } from './TelegramConnect';

const status = (overrides: Partial<TelegramStatus> = {}): TelegramStatus => ({
  enabled: true,
  botUsername: 'invest_bonds_bot',
  linked: false,
  username: null,
  linkedAt: null,
  available: true,
  checkedAt: '2026-11-08T10:00:00Z',
  ...overrides,
});

const LINK = { url: 'https://t.me/invest_bonds_bot?start=abc_DEF-123', expiresAt: '2026-11-08T10:10:00Z' };

async function openPanel() {
  renderRoute(<TelegramConnect />, { path: '/bonds', url: '/bonds' });
  await userEvent.click(screen.getByRole('button', { name: 'Уведомления в Telegram' }));
}

afterEach(() => vi.unstubAllGlobals());

describe('TelegramConnect', () => {
  it('не запрашивает статус, пока панель закрыта', () => {
    const calls = mockFetch({ body: status() });

    renderRoute(<TelegramConnect />, { path: '/bonds', url: '/bonds' });

    expect(calls).toHaveLength(0);
  });

  it('выдаёт одноразовую ссылку и ждёт привязки', async () => {
    const ym = enableAnalytics();
    const calls = mockFetch({ body: status() }, { body: LINK }, { body: status({ linked: true, username: 'alice' }) });

    await openPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Подключить Telegram' }));

    expect(await screen.findByRole('link', { name: 'Открыть в приложении Telegram' })).toHaveAttribute(
      'href',
      'tg://resolve?domain=invest_bonds_bot&start=abc_DEF-123',
    );
    expect(screen.getByRole('link', { name: 'Открыть через t.me' })).toHaveAttribute('href', LINK.url);
    // если Telegram потерял параметр start, код можно отправить боту вручную
    expect(screen.getByText('abc_DEF-123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скопировать код' })).toBeInTheDocument();
    expect(calls[1]).toMatchObject({ url: '/api/alerts/telegram/link-token', init: { method: 'POST' } });
    // после /start в боте статус меняется - панель узнаёт об этом опросом
    expect(await screen.findByText(/Подключён @alice/, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(sentGoals(ym)).toEqual([['telegram_connected', undefined]]);
  });

  it('отключает привязанный чат', async () => {
    const calls = mockFetch(
      { body: status({ linked: true, username: 'alice', linkedAt: '2026-11-08T09:00:00Z' }) },
      { status: 204, body: null },
      { body: status() },
    );

    await openPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Отключить' }));

    expect(await screen.findByRole('button', { name: 'Подключить Telegram' })).toBeInTheDocument();
    expect(calls[1]).toMatchObject({ url: '/api/alerts/telegram', init: { method: 'DELETE' } });
  });

  it('сообщает, что бот выключен на сервере', async () => {
    mockFetch({ body: status({ enabled: false }) });

    await openPanel();

    expect(await screen.findByText('Бот уведомлений выключен на сервере.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Подключить Telegram' })).not.toBeInTheDocument();
  });

  it('предупреждает, что сервер не может связаться с Telegram', async () => {
    mockFetch({ body: status({ available: false }) });

    await openPanel();

    expect(await screen.findByText(/Сервер сейчас не может связаться с Telegram/)).toBeInTheDocument();
  });

  it('показывает ошибку создания ссылки', async () => {
    mockFetch({ body: status() }, { status: 422, body: { title: 'Unprocessable Entity', detail: 'Telegram bot is disabled' } });

    await openPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Подключить Telegram' }));

    await waitFor(() => expect(screen.getByText('Telegram bot is disabled')).toBeInTheDocument());
  });
});
