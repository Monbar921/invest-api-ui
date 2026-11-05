import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BondEvent } from '../api/types';
import { mockFetchByUrl, renderRoute } from '../test/render';
import { BondEventsAndNews } from './BondEventsAndNews';

const rub = (quantity: number) => ({ quantity, currency: 'rub' });

const coupon = (date: string, amount: number | null, previous?: number): BondEvent => ({
  type: 'COUPON',
  date,
  amount: amount == null ? null : rub(amount),
  previousAmount: previous == null ? null : rub(previous),
});

const NOW = new Date(2026, 10, 5);

afterEach(() => vi.unstubAllGlobals());

describe('BondEventsAndNews', () => {
  it('показывает события из графика выплат: прошедшие, изменение купона, необъявленный размер', async () => {
    mockFetchByUrl([
      [
        /\/events$/,
        [
          coupon('2026-10-14', 15.21),
          coupon('2026-11-14', 15.71, 15.21),
          coupon('2026-12-14', null),
          { type: 'OFFER', date: '2027-01-10', amount: null, previousAmount: null },
          { type: 'MATURITY', date: '2029-03-14', amount: rub(1000), previousAmount: null },
        ],
      ],
    ]);

    renderRoute(<BondEventsAndNews ticker="RU000A10EQ34" now={NOW} />, { path: '/bonds/:ticker', url: '/bonds/RU000A10EQ34' });

    const rows = await screen.findAllByRole('row');
    // заголовок + 5 событий
    expect(rows).toHaveLength(6);
    expect(within(rows[2]!).getByText(/вырос, был/)).toBeInTheDocument();
    expect(within(rows[3]!).getByText('не объявлен')).toBeInTheDocument();
    expect(within(rows[4]!).getByText('Оферта')).toBeInTheDocument();
    expect(within(rows[5]!).getByText('Погашение')).toBeInTheDocument();
  });

  it('у долгого выпуска показывает ближайшие события и раскрывает все', async () => {
    const events = Array.from({ length: 12 }, (_, index) => coupon(`2027-${String(index + 1).padStart(2, '0')}-01`, 10));
    mockFetchByUrl([[/\/events$/, events]]);

    renderRoute(<BondEventsAndNews ticker="X" now={NOW} />, { path: '/bonds/:ticker', url: '/bonds/X' });

    expect(await screen.findAllByRole('row')).toHaveLength(9);
    await userEvent.click(screen.getByRole('button', { name: 'Все будущие (12)' }));
    expect(screen.getAllByRole('row')).toHaveLength(13);
  });

  it('новости - на отдельной вкладке', async () => {
    const calls = mockFetchByUrl([
      [/\/events$/, []],
      [
        /\/X\/news\?/,
        {
          content: [
            {
              id: 1,
              source: 'MOEX',
              title: 'О порядке приобретения облигаций',
              summary: null,
              url: 'https://www.moex.com/n1',
              publishedAt: '2026-11-05T13:05:20Z',
              bonds: [],
              issuers: ['ООО "Пушкинское ПЗ"'],
            },
          ],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        },
      ],
    ]);

    renderRoute(<BondEventsAndNews ticker="X" now={NOW} />, { path: '/bonds/:ticker', url: '/bonds/X' });

    expect(await screen.findByText('Событий нет: график выплат ещё не загружен')).toBeInTheDocument();
    // новости не грузятся, пока вкладку не открыли
    expect(calls.some((url) => url.includes('/news'))).toBe(false);

    await userEvent.click(screen.getByRole('tab', { name: 'Новости' }));
    expect(await screen.findByText('О порядке приобретения облигаций')).toBeInTheDocument();
    expect(screen.getByText('ООО "Пушкинское ПЗ"')).toBeInTheDocument();
  });
});
