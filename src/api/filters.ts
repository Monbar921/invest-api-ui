import { request } from './client';
import type { BondParameters, BondScope, SavedFilter } from './types';

// пользовательские фильтры - под /api/alerts/**: gateway уже пропускает этот путь с пользователем из сессии
const FILTERS_PATH = '/api/alerts/filters';

/** Как в адресе списка облигаций ('local') → как в API фильтров ('LOCAL') */
export function toFilterScope(scope: BondScope): SavedFilter['scope'] {
  return scope.toUpperCase() as SavedFilter['scope'];
}

export function fromFilterScope(scope: SavedFilter['scope']): BondScope {
  return scope.toLowerCase() as BondScope;
}

export interface SavedFilterInput {
  name?: string;
  scope?: SavedFilter['scope'];
  parameters?: BondParameters;
  notify?: boolean;
}

export function fetchSavedFilters(): Promise<SavedFilter[]> {
  return request<SavedFilter[]>(FILTERS_PATH);
}

export function createSavedFilter(filter: SavedFilterInput & { name: string }): Promise<SavedFilter> {
  return request<SavedFilter>(FILTERS_PATH, { method: 'POST', body: JSON.stringify(filter) });
}

export function updateSavedFilter(id: number, changes: SavedFilterInput): Promise<SavedFilter> {
  return request<SavedFilter>(`${FILTERS_PATH}/${id}`, { method: 'PUT', body: JSON.stringify(changes) });
}

export function deleteSavedFilter(id: number): Promise<void> {
  return request<void>(`${FILTERS_PATH}/${id}`, { method: 'DELETE' });
}
