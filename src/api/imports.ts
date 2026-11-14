import { request } from './client';
import type { BrokerAccount, BrokerConnection, ImportSource, PortfolioImport } from './types';

// gateway пропускает /api/portfolio/** в invest-api
const IMPORTS_PATH = '/api/portfolio/imports';

/** Подключён ли токен T-Invest и включён ли импорт по токену */
export function fetchBrokerConnection(): Promise<BrokerConnection> {
  return request<BrokerConnection>(`${IMPORTS_PATH}/tinvest`);
}

/** Подключить токен только на чтение: бэк проверяет его в T-Invest и хранит зашифрованным */
export function connectBroker(token: string): Promise<BrokerConnection> {
  return request<BrokerConnection>(`${IMPORTS_PATH}/tinvest`, { method: 'PUT', body: JSON.stringify({ token }) });
}

export function disconnectBroker(): Promise<void> {
  return request<void>(`${IMPORTS_PATH}/tinvest`, { method: 'DELETE' });
}

export function fetchBrokerAccounts(): Promise<BrokerAccount[]> {
  return request<BrokerAccount[]>(`${IMPORTS_PATH}/tinvest/accounts`);
}

/**
 * Предпросмотр сделок со счетов T-Invest; from не задан - вся история. broker - брокер у созданных сделок, пусто -
 * «Т-Инвестиции»
 */
export function previewTinvestImport(accountIds: string[], from: string | null, broker: string | null): Promise<PortfolioImport> {
  return request<PortfolioImport>(`${IMPORTS_PATH}/tinvest/preview`, {
    method: 'POST',
    body: JSON.stringify({ accountIds, from, broker }),
  });
}

/** Предпросмотр сделок из файла отчёта брокера; broker - брокер у созданных сделок, пусто - из отчёта */
export function previewFileImport(
  format: Exclude<ImportSource, 'TINVEST_API'>,
  file: File,
  broker: string | null,
): Promise<PortfolioImport> {
  const body = new FormData();
  body.append('file', file);
  const query = new URLSearchParams({ format });
  if (broker) {
    query.set('broker', broker);
  }
  return request<PortfolioImport>(`${IMPORTS_PATH}/file/preview?${query}`, { method: 'POST', body });
}

/** Создать выбранные сделки предпросмотра; в ответе - отчёт */
export function applyImport(id: number, itemIds: number[]): Promise<PortfolioImport> {
  return request<PortfolioImport>(`${IMPORTS_PATH}/${id}/apply`, { method: 'POST', body: JSON.stringify({ itemIds }) });
}

export function fetchImport(id: number): Promise<PortfolioImport> {
  return request<PortfolioImport>(`${IMPORTS_PATH}/${id}`);
}

/** Последние импорты, без строк */
export function fetchImports(): Promise<PortfolioImport[]> {
  return request<PortfolioImport[]>(IMPORTS_PATH);
}
