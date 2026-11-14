import { download, request } from './client';
import type {
  Bond,
  BondCollection,
  BondCollectionPage,
  BondExportFormat,
  BondEvent,
  BondParameters,
  BondScope,
  BondSearchItem,
  BrokerLink,
  Candle,
  CandleInterval,
  Issuer,
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

/** Вся выборка с фильтрами и сортировкой - файлом CSV или Excel; только после входа */
export function exportBonds(
  scope: BondScope,
  format: BondExportFormat,
  parameters: BondParameters,
): Promise<{ blob: Blob; fileName: string }> {
  return download(
    `${BONDS_PATH}/${scope}/export?${new URLSearchParams({ format })}`,
    { method: 'POST', body: JSON.stringify(parameters) },
    `bonds.${format === 'XLSX' ? 'xlsx' : 'csv'}`,
  );
}

/** Секторы облигаций в системе - значения фильтра */
export function fetchSectors(): Promise<string[]> {
  return request<string[]>(`${BONDS_PATH}/sectors`);
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

/** Эмитент с выпусками; id - id эмитента на Мосбирже */
export function fetchIssuer(id: number): Promise<Issuer> {
  return request<Issuer>(`${BONDS_PATH}/issuers/${id}`);
}

export function fetchIssuerNews(id: number, page: number, size: number): Promise<Page<NewsItem>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return request<Page<NewsItem>>(`${BONDS_PATH}/issuers/${id}/news?${params}`);
}

export function fetchCollections(): Promise<BondCollection[]> {
  return request<BondCollection[]>(`${BONDS_PATH}/collections`);
}

export function fetchCollection(slug: string, page: number, size: number): Promise<BondCollectionPage> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return request<BondCollectionPage>(`${BONDS_PATH}/collections/${encodeURIComponent(slug)}?${params}`);
}

/** Ссылки брокеров-партнёров для облигации; партнёров нет - пустой список */
export function fetchBrokerLinks(ticker: string): Promise<BrokerLink[]> {
  return request<BrokerLink[]>(`${BONDS_PATH}/${encodeURIComponent(ticker)}/broker-links`);
}

/** Учёт перехода к партнёру. keepalive: запрос доходит, даже если вкладка уже уходит по ссылке */
export function registerBrokerClick(ticker: string, partnerId: string): Promise<void> {
  return request<void>(`${BONDS_PATH}/${encodeURIComponent(ticker)}/broker-links/${encodeURIComponent(partnerId)}/click`, {
    method: 'POST',
    keepalive: true,
  });
}
