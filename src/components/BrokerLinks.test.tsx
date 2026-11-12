import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GUEST, type Session } from '../api/session';
import type { BrokerLink } from '../api/types';
import { renderRoute } from '../test/render';
import { BrokerLinks } from './BrokerLinks';

const links: BrokerLink[] = [
  {
    partnerId: 'alpha',
    name: 'Альфа Брокер',
    url: 'https://alpha.test/bonds/RU000A1038V6?ref=invest',
    advertiser: 'АО "Альфа Брокер", ИНН 7700000001',
    erid: '2SDnjAlpha',
  },
  {
    partnerId: 'beta',
    name: 'Бета Инвест',
    url: 'https://beta.test/buy?ticker=SU26238RMFS4',
    advertiser: 'ООО "Бета Инвест", ИНН 7700000002',
    erid: null,
  },
];

/** Отвечает ссылками на GET и clickStatus (по умолчанию 204) на клик; запросы складывает в calls */
function mockBrokerApi(body: unknown, status = 200, clickStatus = 204) {
  const calls: { url: string; method: string; keepalive?: boolean }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', keepalive: init?.keepalive });
    if (url.endsWith('/click')) {
      return clickStatus === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify({ title: 'Internal Server Error' }), { status: clickStatus });
    }
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

const renderBlock = (ticker = 'SU26238RMFS4', session?: Session) =>
  renderRoute(
    <>
      <BrokerLinks ticker={ticker} />
      <div>карточка</div>
    </>,
    { path: '/bonds/:ticker', url: `/bonds/${encodeURIComponent(ticker)}`, session },
  );

describe('Купить у брокера', () => {
  it('без партнёров блока нет', async () => {
    const calls = mockBrokerApi([]);
    renderBlock();

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.getByText('карточка')).toBeInTheDocument();
    expect(screen.queryByText('Купить у брокера')).not.toBeInTheDocument();
  });

  it('ошибка запроса не ломает страницу: блока просто нет', async () => {
    const calls = mockBrokerApi({ title: 'Not Found' }, 404);
    renderBlock();

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.queryByText('Купить у брокера')).not.toBeInTheDocument();
  });

  it('ссылки партнёров с пометкой «Реклама», рекламодателем и erid', async () => {
    mockBrokerApi(links);
    renderBlock();

    const alpha = await screen.findByRole('link', { name: /Альфа Брокер/ });
    expect(alpha).toHaveAttribute('href', 'https://alpha.test/bonds/RU000A1038V6?ref=invest');
    expect(alpha).toHaveAttribute('target', '_blank');
    expect(alpha).toHaveAttribute('rel', 'sponsored noopener noreferrer');
    expect(screen.getByText('Реклама')).toBeInTheDocument();
    expect(screen.getByText('Реклама. АО "Альфа Брокер", ИНН 7700000001. erid: 2SDnjAlpha')).toBeInTheDocument();
    // без erid - только рекламодатель
    expect(screen.getByText('Реклама. ООО "Бета Инвест", ИНН 7700000002')).toBeInTheDocument();
  });

  it('клик по ссылке учитывается', async () => {
    const calls = mockBrokerApi(links);
    renderBlock();

    const beta = await screen.findByRole('link', { name: /Бета Инвест/ });
    // jsdom не переходит по ссылкам с target=_blank, клик только отправляет учёт
    await userEvent.click(beta);

    await waitFor(() =>
      expect(calls).toContainEqual({
        url: '/api/bonds/SU26238RMFS4/broker-links/beta/click',
        method: 'POST',
        keepalive: true,
      }),
    );
  });

  it('партнёры идут в порядке ответа бэка', async () => {
    const gamma: BrokerLink = { ...links[0]!, partnerId: 'gamma', name: 'Гамма', url: 'https://gamma.test/x' };
    mockBrokerApi([links[1], gamma, links[0]]);
    renderBlock();

    await screen.findByRole('link', { name: /Бета Инвест/ });
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Бета Инвест', 'Гамма', 'Альфа Брокер']);
  });

  it('сбой учёта клика пользователю не показывается, ссылка остаётся', async () => {
    const calls = mockBrokerApi(links, 200, 500);
    renderBlock();

    await userEvent.click(await screen.findByRole('link', { name: /Альфа Брокер/ }));

    await waitFor(() => expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1));
    // ошибка мутации глотается: ни текста ошибки, ни повтора, блок на месте
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expect(screen.queryByText(/Internal Server Error|Ошибка/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Альфа Брокер/ })).toHaveAttribute('href', links[0]!.url);
    expect(screen.getByText('карточка')).toBeInTheDocument();
  });

  it('тикер со спецсимволами кодируется в адресах запросов', async () => {
    const calls = mockBrokerApi(links);
    renderBlock('A/B C#?');

    await userEvent.click(await screen.findByRole('link', { name: /Бета Инвест/ }));

    await waitFor(() =>
      expect(calls.map((call) => call.url)).toEqual([
        '/api/bonds/A%2FB%20C%23%3F/broker-links',
        '/api/bonds/A%2FB%20C%23%3F/broker-links/beta/click',
      ]),
    );
  });

  it('гость тоже отправляет учёт клика', async () => {
    const calls = mockBrokerApi(links);
    renderBlock('SU26238RMFS4', GUEST);

    await userEvent.click(await screen.findByRole('link', { name: /Альфа Брокер/ }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        url: '/api/bonds/SU26238RMFS4/broker-links/alpha/click',
        method: 'POST',
        keepalive: true,
      }),
    );
  });
});
