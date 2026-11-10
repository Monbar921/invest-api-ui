import { screen, waitFor } from '@testing-library/react';
import type { Bond, BondCollectionPage, Issuer } from '../api/types';
import { applyPageMeta } from '../lib/seo';
import { EMPTY_NEWS_PAGE, mockFetchByUrl, renderRoute } from '../test/render';
import { BondPage } from './BondPage';
import { BondsPage } from './BondsPage';
import { CollectionPage } from './CollectionPage';
import { IssuerPage } from './IssuerPage';

const bond = (ticker: string, overrides: Partial<Bond> = {}): Bond => ({
  ticker,
  uid: `uid-${ticker}`,
  isin: `RU${ticker}`,
  name: `Облигация ${ticker}`,
  sector: 'financial',
  price: {
    uid: null,
    nominal: { quantity: 1000, currency: 'rub' },
    current: { quantity: 950, currency: 'rub' },
    currentInRub: 950,
    percentagePrice: 95,
    aci: null,
  },
  coupon: {
    uid: null,
    quantityPerYear: 4,
    interest: 12.5,
    isFixed: true,
    yieldToMaturity: 14.25,
    yieldToOffer: null,
    couponData: null,
  },
  riskLevel: 'RISK_LEVEL_LOW',
  maturityDate: '2030-01-01T00:00:00Z',
  offerDate: null,
  amortizationFlag: false,
  ...overrides,
});

const issuer: Issuer = {
  id: 42,
  title: 'Публичное акционерное общество "Селигдар"',
  shortTitle: 'ПАО "Селигдар"',
  inn: '0102001234',
  bonds: [bond('SELG1'), bond('SELG2')],
};

const head = (selector: string) => document.head.querySelector(selector);
const canonical = () => head('link[rel="canonical"]')?.getAttribute('href');
const meta = (key: string) => (head(`meta[name="${key}"]`) ?? head(`meta[property="${key}"]`))?.getAttribute('content') ?? null;

beforeEach(() => {
  document.head.innerHTML = '';
  document.title = '';
});

describe('метаданные страниц', () => {
  it('карточка облигации: title, description, canonical, og и ссылка на эмитента', async () => {
    mockFetchByUrl([
      [/\/api\/bonds\/SELG1$/, bond('SELG1', { issuer: { id: 42, shortTitle: 'ПАО "Селигдар"' } })],
      [/\/api\/bonds\/SELG1\/candles/, []],
    ]);

    renderRoute(<BondPage />, { path: '/bonds/:ticker', url: '/bonds/SELG1' });

    expect(await screen.findByRole('link', { name: 'Эмитент: ПАО "Селигдар"' })).toHaveAttribute('href', '/issuers/42');
    await waitFor(() => expect(document.title).toBe('Облигация SELG1 (SELG1) - цена и доходность облигации - Облигации'));
    expect(meta('description')).toBe(
      'Облигация SELG1, ISIN RUSELG1, цена 95 % от номинала, доходность к погашению 14,25 % годовых, ' +
        'погашение 01.01.2030. График цены, выплаты купонов и новости.',
    );
    expect(canonical()).toBe('http://localhost:3000/bonds/SELG1');
    expect(meta('og:type')).toBe('article');
    expect(meta('og:title')).toBe(document.title);
  });

  it('страница эмитента: название, ИНН, выпуски со ссылками, новости', async () => {
    mockFetchByUrl([
      [/\/api\/bonds\/issuers\/42$/, issuer],
      [
        /\/api\/bonds\/issuers\/42\/news/,
        {
          ...EMPTY_NEWS_PAGE,
          totalElements: 1,
          totalPages: 1,
          content: [
            {
              id: 1,
              source: 'ACRA',
              title: 'АКРА подтвердило рейтинг',
              summary: null,
              url: 'https://acra.test/1',
              publishedAt: '2026-11-01T00:00:00+03:00',
              bonds: [],
              issuers: ['ПАО "Селигдар"'],
            },
          ],
        },
      ],
    ]);

    renderRoute(<IssuerPage />, { path: '/issuers/:id', url: '/issuers/42' });

    expect(await screen.findByRole('heading', { name: 'ПАО "Селигдар"' })).toBeInTheDocument();
    expect(screen.getByText('Публичное акционерное общество "Селигдар"')).toBeInTheDocument();
    expect(screen.getByText('ИНН 0102001234')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'SELG2' })).toHaveAttribute('href', '/bonds/SELG2');
    expect(await screen.findByText('АКРА подтвердило рейтинг')).toBeInTheDocument();
    expect(document.title).toBe('ПАО "Селигдар" - облигации эмитента - Облигации');
    expect(meta('description')).toContain('(ИНН 0102001234): выпусков в обращении - 2.');
    expect(canonical()).toBe('http://localhost:3000/issuers/42');
  });

  it('неизвестный эмитент и нечисловой id - 404 без индексации', async () => {
    mockFetchByUrl([]);
    renderRoute(<IssuerPage />, { path: '/issuers/:id', url: '/issuers/7' });

    expect(await screen.findByText('Эмитент не найден')).toBeInTheDocument();
    expect(meta('robots')).toBe('noindex');
    expect(canonical()).toBeUndefined();
  });

  it('нечисловой id эмитента не запрашивается', async () => {
    const calls = mockFetchByUrl([]);
    renderRoute(<IssuerPage />, { path: '/issuers/:id', url: '/issuers/abc' });

    expect(await screen.findByText('Эмитент не найден')).toBeInTheDocument();
    expect(calls.filter((url) => url.includes('/issuers/'))).toHaveLength(0);
  });

  it('подборка: заголовок, описание, облигации в порядке бэка, страница в запросе', async () => {
    const collection: BondCollectionPage = {
      slug: 'ofz-top-yield',
      title: 'Самые доходные ОФЗ',
      description: 'ОФЗ по доходности к погашению.',
      bonds: { content: [bond('OFZ2'), bond('OFZ1')], page: 1, size: 50, totalElements: 52, totalPages: 2 },
    };
    const calls = mockFetchByUrl([[/\/api\/bonds\/collections\/ofz-top-yield\?/, collection]]);

    renderRoute(<CollectionPage />, { path: '/collections/:slug', url: '/collections/ofz-top-yield?page=2' });

    expect(await screen.findByRole('heading', { name: 'Самые доходные ОФЗ' })).toBeInTheDocument();
    expect(screen.getByText('ОФЗ по доходности к погашению.')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /^OFZ/ }).map((link) => link.textContent);
    expect(links).toEqual(['OFZ2', 'OFZ1']);
    expect(calls).toContain('/api/bonds/collections/ofz-top-yield?page=1&size=50');
    expect(document.title).toBe('Самые доходные ОФЗ - Облигации');
    // страница 2 - та же подборка: canonical без ?page
    expect(canonical()).toBe('http://localhost:3000/collections/ofz-top-yield');
  });

  it('неизвестная подборка - 404', async () => {
    mockFetchByUrl([]);
    renderRoute(<CollectionPage />, { path: '/collections/:slug', url: '/collections/unknown' });

    expect(await screen.findByText('Такой подборки нет')).toBeInTheDocument();
  });

  it('список облигаций: ссылки на подборки и canonical без фильтров', async () => {
    mockFetchByUrl([
      [/\/api\/bonds\/collections$/, [{ slug: 'floaters', title: 'Флоатеры', description: '...' }]],
      [/\/api\/bonds\/all\/page/, { content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 }],
    ]);

    renderRoute(<BondsPage />, { path: '/bonds', url: '/bonds?scope=all&ofz=only' });

    expect(await screen.findByRole('link', { name: 'Флоатеры' })).toHaveAttribute('href', '/collections/floaters');
    expect(canonical()).toBe('http://localhost:3000/bonds');
  });

  it('метаданные заменяют прежние, а не добавляются', () => {
    applyPageMeta({ title: 'A', description: 'a', canonicalPath: '/a' });
    applyPageMeta({ title: 'B', noindex: true });

    expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(0);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(0);
    expect(meta('robots')).toBe('noindex');
    expect(document.title).toBe('B - Облигации');
  });
});
