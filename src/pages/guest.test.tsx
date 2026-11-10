import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loginUrl } from '../api/client';
import { GUEST, parseSession } from '../api/session';
import { BondAlertsButton } from '../components/BondAlertsButton';
import { AppLayout } from '../layout/AppLayout';
import { mockFetchByUrl, renderRoute, USER } from '../test/render';
import { AlertsPage } from './AlertsPage';
import { PortfolioPage } from './PortfolioPage';

const TICKER = 'RU000A10EQ34';
const personal = (calls: string[]) => calls.filter((url) => /\/api\/(alerts|portfolio)/.test(url));

afterEach(() => vi.unstubAllGlobals());

describe('гость', () => {
  it('в шапке - «Войти» вместо Telegram и выхода', () => {
    mockFetchByUrl([]);
    renderRoute(<AppLayout />, { path: '/bonds', url: '/bonds', session: GUEST });

    expect(screen.getAllByRole('button', { name: 'Войти' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Выйти' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Уведомления в Telegram' })).not.toBeInTheDocument();
    // разделы видны и гостю - войти предложат внутри
    expect(screen.getByRole('link', { name: 'Портфель' })).toBeInTheDocument();
  });

  it('у вошедшего - Telegram и выход, без «Войти»', () => {
    mockFetchByUrl([]);
    renderRoute(<AppLayout />, { path: '/bonds', url: '/bonds', session: USER });

    expect(screen.getByRole('button', { name: 'Выйти' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Уведомления в Telegram' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Войти' })).not.toBeInTheDocument();
  });

  it('портфель предлагает войти и не запрашивает личные данные', () => {
    const calls = mockFetchByUrl([]);
    renderRoute(<PortfolioPage />, { path: '/portfolio', url: '/portfolio', session: GUEST });

    expect(screen.getByRole('heading', { name: 'Портфель' })).toBeInTheDocument();
    expect(screen.getByText(/Войдите, чтобы вести свои покупки/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Добавить покупку' })).not.toBeInTheDocument();
    expect(personal(calls)).toEqual([]);
  });

  it('уведомления предлагают войти и не запрашивают правила', () => {
    const calls = mockFetchByUrl([]);
    renderRoute(<AlertsPage />, { path: '/alerts', url: '/alerts', session: GUEST });

    expect(screen.getByRole('heading', { name: 'Уведомления' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(personal(calls)).toEqual([]);
  });

  it('колокольчик облигации открывает предложение войти', async () => {
    const calls = mockFetchByUrl([]);
    renderRoute(<BondAlertsButton ticker={TICKER} name="Авто Финанс" />, { path: '/bonds', url: '/bonds', session: GUEST });

    await userEvent.click(screen.getByRole('button', { name: `Уведомления: ${TICKER}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Уведомления: Авто Финанс' });

    expect(within(dialog).getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument();
    expect(personal(calls)).toEqual([]);
  });
});

describe('вход', () => {
  it('ведёт на логин gateway с возвратом на ту же страницу', () => {
    expect(loginUrl('/bonds/RU000A10EQ34?tab=news')).toBe(
      '/oauth2/authorization/keycloak?returnTo=%2Fbonds%2FRU000A10EQ34%3Ftab%3Dnews',
    );
  });

  it('ответ /api/session: вошедший, гость и непонятный ответ', () => {
    expect(parseSession({ authenticated: true, username: 'ivan' })).toEqual({ authenticated: true, username: 'ivan' });
    expect(parseSession({ authenticated: false, username: null })).toEqual(GUEST);
    expect(parseSession(null)).toEqual(GUEST);
    expect(parseSession('<html>')).toEqual(GUEST);
  });
});
