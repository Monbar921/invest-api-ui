import type { BondParameters, BondScope, BondSortField, RiskLevel, SortOrder, ValueRange } from '../api/types';
import { FILTERABLE_RISK_LEVELS, RATING_GRADES } from './format';

// Состояние таблицы облигаций живёт в query-строке: выборку можно сохранить ссылкой, «Назад» работает

export const PAGE_SIZES = [25, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;
/** Как и на бэке без параметров: по текущей цене в рублях по возрастанию */
export const DEFAULT_SORT: { field: BondSortField; order: SortOrder } = { field: 'PRICE', order: 'ASC' };
/** Выплат купона в год, по которым можно фильтровать */
export const COUPON_FREQUENCIES = [1, 2, 4, 12];

const SCOPES: BondScope[] = ['all', 'local', 'foreign'];
const SORT_FIELDS: BondSortField[] = [
  'RISK_LEVEL',
  'COUPON_INTEREST',
  'MATURITY_DATE',
  'TICKER',
  'NAME',
  'PRICE',
  'PERCENTAGE_PRICE',
  'YIELD_TO_MATURITY',
  'YIELD_TO_OFFER',
  'DURATION',
  'CREDIT_RATING',
  'AVG_DAILY_TURNOVER',
  'SPREAD_TO_OFZ',
];

export type OfzFilter = 'any' | 'only' | 'exclude';
/** Тип купона: постоянный (фиксированный) или переменный (флоатер) */
export type CouponTypeFilter = 'any' | 'fixed' | 'floating';
/** Есть ли у облигации оферта / амортизация */
export type PresenceFilter = 'any' | 'with' | 'without';

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
  couponType: CouponTypeFilter;
  // фильтры скринера - на панели «Ещё фильтры»
  sectors: string[];
  yearsMin?: number;
  yearsMax?: number;
  frequencies: number[];
  offer: PresenceFilter;
  amortization: PresenceFilter;
  /** Худшая допустимая ступень рейтинга («BBB-»): не ниже */
  ratingMin?: string;
  durationMin?: number;
  durationMax?: number;
  ytmMin?: number;
  ytmMax?: number;
  /** Средний дневной оборот, ₽ - не меньше */
  turnoverMin?: number;
  spreadMin?: number;
  spreadMax?: number;
}

/** Фильтры без значений - для «Сбросить» */
export const EMPTY_FILTERS: Partial<BondSearchState> = {
  priceMin: undefined,
  priceMax: undefined,
  percentMin: undefined,
  percentMax: undefined,
  riskLevels: [],
  ofz: 'any',
  couponType: 'any',
  sectors: [],
  yearsMin: undefined,
  yearsMax: undefined,
  frequencies: [],
  offer: 'any',
  amortization: 'any',
  ratingMin: undefined,
  durationMin: undefined,
  durationMax: undefined,
  ytmMin: undefined,
  ytmMax: undefined,
  turnoverMin: undefined,
  spreadMin: undefined,
  spreadMax: undefined,
};

/** Задан ли хоть один фильтр панели «Ещё фильтры» - тогда она открыта сразу */
export function hasScreenerFilters(state: BondSearchState): boolean {
  return (
    state.sectors.length > 0 ||
    state.frequencies.length > 0 ||
    state.offer !== 'any' ||
    state.amortization !== 'any' ||
    [
      state.yearsMin,
      state.yearsMax,
      state.ratingMin,
      state.durationMin,
      state.durationMax,
      state.ytmMin,
      state.ytmMax,
      state.turnoverMin,
      state.spreadMin,
      state.spreadMax,
    ].some((value) => value !== undefined)
  );
}

export function hasFilters(state: BondSearchState): boolean {
  return (
    state.priceMin !== undefined ||
    state.priceMax !== undefined ||
    state.percentMin !== undefined ||
    state.percentMax !== undefined ||
    state.riskLevels.length > 0 ||
    state.ofz !== 'any' ||
    state.couponType !== 'any' ||
    hasScreenerFilters(state)
  );
}

const PRESENCE: PresenceFilter[] = ['any', 'with', 'without'];

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
    riskLevels: list(params.get('risk')).filter((level): level is RiskLevel =>
      FILTERABLE_RISK_LEVELS.includes(level as RiskLevel),
    ),
    ofz: oneOf(params.get('ofz'), ['any', 'only', 'exclude'] as OfzFilter[], 'any'),
    couponType: oneOf(params.get('coupon'), ['any', 'fixed', 'floating'] as CouponTypeFilter[], 'any'),
    // секторы приходят с бэка - проверять их по списку здесь нечем, только формат
    sectors: list(params.get('sector')).filter((sector) => /^[a-z_]{1,40}$/.test(sector)),
    yearsMin: number(params.get('yearsMin')),
    yearsMax: number(params.get('yearsMax')),
    frequencies: list(params.get('freq'))
      .map(Number)
      .filter((frequency) => COUPON_FREQUENCIES.includes(frequency)),
    offer: oneOf(params.get('offer'), PRESENCE, 'any'),
    amortization: oneOf(params.get('amort'), PRESENCE, 'any'),
    ratingMin: oneOf<string | undefined>(params.get('ratingMin') ?? undefined, RATING_GRADES, undefined),
    durationMin: number(params.get('durMin')),
    durationMax: number(params.get('durMax')),
    ytmMin: number(params.get('ytmMin')),
    ytmMax: number(params.get('ytmMax')),
    turnoverMin: number(params.get('turnoverMin')),
    spreadMin: number(params.get('spreadMin')),
    spreadMax: number(params.get('spreadMax')),
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
  set('coupon', state.couponType, 'any');
  set('sector', state.sectors.join(','));
  set('yearsMin', state.yearsMin);
  set('yearsMax', state.yearsMax);
  set('freq', state.frequencies.join(','));
  set('offer', state.offer, 'any');
  set('amort', state.amortization, 'any');
  set('ratingMin', state.ratingMin);
  set('durMin', state.durationMin);
  set('durMax', state.durationMax);
  set('ytmMin', state.ytmMin);
  set('ytmMax', state.ytmMax);
  set('turnoverMin', state.turnoverMin);
  set('spreadMin', state.spreadMin);
  set('spreadMax', state.spreadMax);

  return params;
}

export function toBondParameters(state: BondSearchState): BondParameters {
  return {
    bondSorts: [{ sortField: state.sortField, sortOrder: state.sortOrder }],
    currentPrice: range(state.priceMin, state.priceMax),
    percentagePrice: range(state.percentMin, state.percentMax),
    riskLevels: state.riskLevels.length > 0 ? state.riskLevels : undefined,
    isOfz: state.ofz === 'any' ? undefined : state.ofz === 'only',
    isFixedCoupon: state.couponType === 'any' ? undefined : state.couponType === 'fixed',
    sectors: state.sectors.length > 0 ? state.sectors : undefined,
    yearsToMaturity: range(state.yearsMin, state.yearsMax),
    couponFrequencies: state.frequencies.length > 0 ? state.frequencies : undefined,
    hasOffer: presence(state.offer),
    hasAmortization: presence(state.amortization),
    creditRating: state.ratingMin ? { min: state.ratingMin } : undefined,
    duration: range(state.durationMin, state.durationMax),
    yieldToMaturity: range(state.ytmMin, state.ytmMax),
    avgDailyTurnover: range(state.turnoverMin, undefined),
    spreadToOfz: range(state.spreadMin, state.spreadMax),
  };
}

function presence(filter: PresenceFilter): boolean | undefined {
  return filter === 'any' ? undefined : filter === 'with';
}

function range(min?: number, max?: number): ValueRange | undefined {
  return min === undefined && max === undefined ? undefined : { min, max };
}

function list(value: string | null): string[] {
  return (value ?? '').split(',').filter((item) => item !== '');
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
