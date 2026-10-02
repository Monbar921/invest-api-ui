import { request } from './client';
import type { Bond, BondParameters, BondScope, Page } from './types';

const BONDS_PATH = '/internal/rest/bonds';

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
