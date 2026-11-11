import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/** Отвечает ссылками на GET и 204 на клик; запросы складывает в calls */
function mockBrokerApi(body: unknown, status = 200) {
  const calls: { url: string; method: string; keepalive?: boolean }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', keepalive: init?.keepalive });
    if (url.endsWith('/click')) {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
}

const renderBlock = () =>
  renderRoute(
    <>
      <BrokerLinks ticker="SU26238RMFS4" />
      <div>карточка</div>
    </>,
    { path: '/bonds/:ticker', url: '/bonds/SU26238RMFS4' },
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
});
