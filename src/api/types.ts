// Типы повторяют DTO invest-api (модуль invest-api-dto). Числа приходят из BigDecimal, даты - ISO-строками.

export type RiskLevel = 'RISK_LEVEL_UNSPECIFIED' | 'RISK_LEVEL_LOW' | 'RISK_LEVEL_MODERATE' | 'RISK_LEVEL_HIGH' | 'UNRECOGNIZED';

export interface Money {
  quantity: number | null;
  currency: string | null;
}

export interface Price {
  uid: string | null;
  nominal: Money | null;
  current: Money | null;
  /** Текущая цена в процентах от номинала */
  percentagePrice: number | null;
}

export interface CouponPayment {
  price: Money | null;
  fixDate: string | null;
  paymentDate: string | null;
}

export interface Coupon {
  uid: string | null;
  quantityPerYear: number;
  /** Годовая доходность купона в % */
  interest: number | null;
  /** График выплат - только в карточке облигации, в списках null */
  couponData: CouponPayment[] | null;
}

export interface Bond {
  ticker: string;
  uid: string;
  isin: string | null;
  name: string | null;
  price: Price | null;
  coupon: Coupon | null;
  riskLevel: RiskLevel | null;
  maturityDate: string | null;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type BondSortField = 'RISK_LEVEL' | 'COUPON_INTEREST' | 'MATURITY_DATE' | 'TICKER' | 'NAME' | 'PRICE' | 'PERCENTAGE_PRICE';

export type SortOrder = 'ASC' | 'DESC';

export interface BondSort {
  sortField: BondSortField;
  sortOrder: SortOrder;
}

export interface ValueRange {
  min?: number;
  max?: number;
}

export interface BondParameters {
  bondSorts?: BondSort[];
  /** Диапазон текущей цены в рублях (валютные облигации - по курсу ЦБ) */
  currentPrice?: ValueRange;
  /** Диапазон текущей цены в % от номинала */
  percentagePrice?: ValueRange;
  riskLevels?: RiskLevel[];
  isOfz?: boolean;
}

/** Выборка облигаций: все, рублёвые или в иностранной валюте */
export type BondScope = 'all' | 'local' | 'foreign';
