import { request } from './client';
import type {
  Bond,
  BondEvent,
  BondParameters,
  BondScope,
  BondSearchItem,
  Candle,
  CandleInterval,
  MarketOverview,
  NewsItem,
  NewsSource,
  Page,
  ProfitCalculation,
  ProfitCalculationRequest,
} from './types';

const BONDS_PATH = '/api/bonds';

export function fetchBondsPage(scope: BondScope, page: number, size: number, parameters: BondParameters): Promise<Page<Bond>> {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  return request<Page<Bond>>(`${BONDS_PATH}/${scope}/page?${query}`, {
    method: 'POST',
    body: JSON.stringify(parameters),
  });
}

export function fetchBond(ticker: string): Promise<Bond> {
  return request<Bond>(`${BONDS_PATH}/${encodeURIComponent(ticker)}`);
}

export function searchBonds(query: string, limit = 20): Promise<BondSearchItem[]> {
  const params = new URLSearchParams({ query, limit: String(limit) });
  return request<BondSearchItem[]>(`${BONDS_PATH}/search?${params}`);
}

export function calculateProfit(ticker: string, parameters: ProfitCalculationRequest): Promise<ProfitCalculation> {
  return request<ProfitCalculation>(`${BONDS_PATH}/${encodeURIComponent(ticker)}/calculation`, {
    method: 'POST',
    body: JSON.stringify(parameters),
  });
}

/** Свечи за период с from (YYYY-MM-DD) по сегодня; без from - вся история */
export function fetchCandles(ticker: string, interval: CandleInterval, from?: string): Promise<Candle[]> {
  const params = new URLSearchParams({ interval });
  if (from) {
    params.set('from', from);
  }
  return request<Candle[]>(`${BONDS_PATH}/${encodeURIComponent(ticker)}/candles?${params}`);
}

/** Общая лента новостей; sources пусто - все источники */
export function fetchNews(sources: NewsSource[], page: number, size: number): Promise<Page<NewsItem>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  sources.forEach((source) => params.append('source', source));
  return request<Page<NewsItem>>(`${BONDS_PATH}/news?${params}`);
}

export function fetchBondNews(ticker: string, page: number, size: number): Promise<Page<NewsItem>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return request<Page<NewsItem>>(`${BONDS_PATH}/${encodeURIComponent(ticker)}/news?${params}`);
}

export function fetchMarketOverview(): Promise<MarketOverview> {
  return request<MarketOverview>(`${BONDS_PATH}/market-overview`);
}

export function fetchBondEvents(ticker: string): Promise<BondEvent[]> {
  return request<BondEvent[]>(`${BONDS_PATH}/${encodeURIComponent(ticker)}/events`);
}
