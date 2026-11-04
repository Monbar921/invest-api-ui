import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Candle } from '../api/types';
import { periodStart } from '../lib/dates';
import { renderRoute } from '../test/render';
import { BondPriceChart } from './BondPriceChart';

const candles: Candle[] = [
  { date: '2026-09-28', open: 100, high: 101, low: 99, close: 100.5, volume: 10 },
  { date: '2026-09-30', open: 100.5, high: 102, low: 100, close: 101, volume: 20 },
  { date: '2026-10-05', open: 101, high: 101.5, low: 100.8, close: 101.2, volume: 5 },
];

function mockCandles(body: Candle[]) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return urls;
}

const render = () => renderRoute(<BondPriceChart ticker="RU000A10EQ34" />, { path: '/', url: '/' });

afterEach(() => vi.unstubAllGlobals());

describe('BondPriceChart', () => {
  it('по умолчанию дневные свечи за год и итог периода', async () => {
    const urls = mockCandles(candles);
    render();

    expect(await screen.findByText('101,2 %')).toBeInTheDocument();
    // изменение - от открытия первой свечи до закрытия последней
    expect(screen.getByText('+1,2 п.п. с 28.09.2026')).toBeInTheDocument();
    expect(urls[0]).toBe(`/api/bonds/RU000A10EQ34/candles?interval=DAY&from=${periodStart('1Y')}`);
  });

  it('интервал и период меняют запрос', async () => {
    const urls = mockCandles(candles);
    render();
    await screen.findByText('101,2 %');

    await userEvent.click(screen.getByText('Н'));
    await waitFor(() => expect(urls.at(-1)).toContain('interval=WEEK'));

    await userEvent.click(screen.getByText('Всё'));
    await waitFor(() => expect(urls.at(-1)).toBe('/api/bonds/RU000A10EQ34/candles?interval=WEEK'));
  });

  it('без сделок - сообщение вместо графика', async () => {
    mockCandles([]);
    render();

    expect(await screen.findByText('Сделок за период не было')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Всё'));
    expect(await screen.findByText('Сделок по облигации ещё не было')).toBeInTheDocument();
  });
});
