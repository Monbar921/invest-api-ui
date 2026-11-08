import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NewsItem, Page } from '../api/types';
import { mockFetchByUrl, renderRoute } from '../test/render';
import { NewsFeed } from './NewsFeed';

const news = (id: number, overrides: Partial<NewsItem> = {}): NewsItem => ({
  id,
  source: 'MOEX',
  title: `Новость ${id}`,
  summary: null,
  url: `https://www.moex.com/n${id}`,
  publishedAt: '2026-11-05T13:05:20Z',
  bonds: [],
  issuers: [],
  ...overrides,
});

const page = (content: NewsItem[], pageNumber = 0, totalPages = 1): Page<NewsItem> => ({
  content,
  page: pageNumber,
  size: 20,
  totalElements: content.length,
  totalPages,
});

const overview = {
  keyRate: 16.5,
  keyRateSince: '2026-10-27',
  previousKeyRate: 17,
  keyRateYearChange: -2,
  keyRateMeetingDate: '2026-10-23',
  keyRateMeetingChange: 0,
  currencies: [
    { code: 'USD', rate: 81.67, change: 0.7 },
    { code: 'EUR', rate: 91.6, change: -1.14 },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('NewsFeed', () => {
  it('показывает ставку, курсы и новости со ссылками на источник и на облигации', async () => {
    mockFetchByUrl([
      [/market-overview/, overview],
      [
        /\/news\?page=0/,
        page([
          news(1, {
            title: 'Банк России снизил ключевую ставку',
            source: 'CBR_PRESS',
            summary: 'Совет директоров снизил ставку',
            url: 'https://www.cbr.ru/press/pr/?file=1',
          }),
          news(2, {
            title: 'О приостановке торгов',
            bonds: [{ ticker: 'RU000A10EQ34', name: 'Авто Финанс Банк БО-001Р-18' }],
            issuers: ['АО "Авто Финанс Банк"'],
          }),
        ]),
      ],
    ]);

    renderRoute(<NewsFeed />, { path: '/bonds', url: '/bonds' });

    expect(await screen.findByText('Банк России снизил ключевую ставку')).toHaveAttribute(
      'href',
      'https://www.cbr.ru/press/pr/?file=1',
    );
    expect(screen.getByText('Совет директоров снизил ставку')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Авто Финанс Банк БО-001Р-18' })).toHaveAttribute('href', '/bonds/RU000A10EQ34');
    expect(screen.getByText('АО "Авто Финанс Банк"')).toBeInTheDocument();

    expect(await screen.findByText('Ключевая ставка')).toBeInTheDocument();
    expect(screen.getByText(/16,5\s%/)).toBeInTheDocument();
    expect(screen.getByText('−2 п.п.')).toBeInTheDocument();
    expect(screen.getByText('с начала года')).toBeInTheDocument();
    // ставку сохранили - ноль, как и остальные изменения, со стрелкой (серой)
    expect(screen.getByText('0 п.п.')).toBeInTheDocument();
    expect(screen.getByText('на заседании 23.10.2026')).toBeInTheDocument();
    expect(screen.getByText('+0,7')).toBeInTheDocument();
    expect(screen.getByText('−1,14')).toBeInTheDocument();
  });

  it('фильтрует по источнику и подгружает следующую страницу', async () => {
    const calls = mockFetchByUrl([
      [/source=MOEX&?$|page=0&size=20&source=MOEX/, page([news(10, { title: 'Только биржа' })])],
      [/\/news\?page=1/, page([news(3, { title: 'Вторая страница' })], 1, 2)],
      [/\/news\?page=0/, page([news(1)], 0, 2)],
    ]);

    renderRoute(<NewsFeed />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('button', { name: 'Показать ещё' }));
    expect(await screen.findByText('Вторая страница')).toBeInTheDocument();
    // страниц больше нет - кнопка пропадает
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Показать ещё' })).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('radio', { name: 'Биржа' }));
    expect(await screen.findByText('Только биржа')).toBeInTheDocument();
    expect(calls).toContain('/api/bonds/news?page=0&size=20&source=MOEX');
  });

  it('рейтинги - одним фильтром, у релиза агентства только дата', async () => {
    const calls = mockFetchByUrl([
      [
        /source=ACRA&source=NKR/,
        page([
          news(5, {
            source: 'ACRA',
            title: 'АКРА ПОДТВЕРДИЛО КРЕДИТНЫЙ РЕЙТИНГ',
            // начало 05.11 по Москве
            publishedAt: '2026-11-04T21:00:00Z',
          }),
        ]),
      ],
      [/\/news\?/, page([news(1)])],
    ]);

    renderRoute(<NewsFeed />, { path: '/bonds', url: '/bonds' });

    await userEvent.click(await screen.findByRole('radio', { name: 'Рейтинги' }));
    expect(await screen.findByText('АКРА ПОДТВЕРДИЛО КРЕДИТНЫЙ РЕЙТИНГ')).toBeInTheDocument();
    expect(screen.getByText('05.11.2026')).toBeInTheDocument();
    expect(calls).toContain('/api/bonds/news?page=0&size=20&source=ACRA&source=NKR');
  });

  it('без ответа ЦБ показывает только новости', async () => {
    mockFetchByUrl([[/\/news\?/, page([news(1, { title: 'Новость биржи' })])]]);

    renderRoute(<NewsFeed />, { path: '/bonds', url: '/bonds' });

    expect(await screen.findByText('Новость биржи')).toBeInTheDocument();
    expect(screen.queryByText('Ключевая ставка')).not.toBeInTheDocument();
  });
});
