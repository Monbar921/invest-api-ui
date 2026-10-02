import type { BondParameters, BondScope, BondSortField, RiskLevel, SortOrder, ValueRange } from '../api/types';
import { FILTERABLE_RISK_LEVELS } from './format';

// Состояние таблицы облигаций живёт в query-строке: выборку можно сохранить ссылкой, «Назад» работает

export const PAGE_SIZES = [25, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;
/** Как и на бэке без параметров: по текущей цене в рублях по возрастанию */
export const DEFAULT_SORT: { field: BondSortField; order: SortOrder } = { field: 'PRICE', order: 'ASC' };

const SCOPES: BondScope[] = ['all', 'local', 'foreign'];
const SORT_FIELDS: BondSortField[] = [
  'RISK_LEVEL',
  'COUPON_INTEREST',
  'MATURITY_DATE',
  'TICKER',
  'NAME',
  'PRICE',
  'PERCENTAGE_PRICE',
];

export type OfzFilter = 'any' | 'only' | 'exclude';

export interface BondSearchState {
  scope: BondScope;
  /** Номер страницы, начиная с 1 - как в пагинации таблицы */
  page: number;
  size: number;
  sortField: BondSortField;
  sortOrder: SortOrder;
  priceMin?: number;
  priceMax?: number;
  percentMin?: number;
  percentMax?: number;
  riskLevels: RiskLevel[];
  ofz: OfzFilter;
}

export function parseBondSearch(params: URLSearchParams): BondSearchState {
  const [sortField, sortOrder] = (params.get('sort') ?? '').split(':');

  return {
    scope: oneOf(params.get('scope'), SCOPES, 'all'),
    page: positiveInt(params.get('page')) ?? 1,
    size: oneOf(positiveInt(params.get('size')), PAGE_SIZES, DEFAULT_PAGE_SIZE),
    sortField: oneOf(sortField, SORT_FIELDS, DEFAULT_SORT.field),
    sortOrder: oneOf(sortOrder, ['ASC', 'DESC'] as SortOrder[], DEFAULT_SORT.order),
    priceMin: number(params.get('priceMin')),
    priceMax: number(params.get('priceMax')),
    percentMin: number(params.get('percentMin')),
    percentMax: number(params.get('percentMax')),
    riskLevels: (params.get('risk') ?? '')
      .split(',')
      .filter((level): level is RiskLevel => FILTERABLE_RISK_LEVELS.includes(level as RiskLevel)),
    ofz: oneOf(params.get('ofz'), ['any', 'only', 'exclude'] as OfzFilter[], 'any'),
  };
}

/** В URL попадают только значения, отличные от умолчаний - ссылки короче */
export function toSearchParams(state: BondSearchState): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | undefined, defaultValue?: string | number) => {
    if (value !== undefined && value !== '' && value !== defaultValue) {
      params.set(key, String(value));
    }
  };

  set('scope', state.scope, 'all');
  set('page', state.page, 1);
  set('size', state.size, DEFAULT_PAGE_SIZE);
  set('sort', `${state.sortField}:${state.sortOrder}`, `${DEFAULT_SORT.field}:${DEFAULT_SORT.order}`);
  set('priceMin', state.priceMin);
  set('priceMax', state.priceMax);
  set('percentMin', state.percentMin);
  set('percentMax', state.percentMax);
  set('risk', state.riskLevels.join(','));
  set('ofz', state.ofz, 'any');

  return params;
}

export function toBondParameters(state: BondSearchState): BondParameters {
  return {
    bondSorts: [{ sortField: state.sortField, sortOrder: state.sortOrder }],
    currentPrice: range(state.priceMin, state.priceMax),
    percentagePrice: range(state.percentMin, state.percentMax),
    riskLevels: state.riskLevels.length > 0 ? state.riskLevels : undefined,
    isOfz: state.ofz === 'any' ? undefined : state.ofz === 'only',
  };
}

function range(min?: number, max?: number): ValueRange | undefined {
  return min === undefined && max === undefined ? undefined : { min, max };
}

function oneOf<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function positiveInt(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function number(value: string | null): number | undefined {
  if (value === null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
