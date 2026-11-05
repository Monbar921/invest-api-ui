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
  /** Текущая цена в рублях по курсу ЦБ; null - цены или курса нет. По ней сортирует PRICE */
  currentInRub: number | null;
  /** Текущая цена в процентах от номинала */
  percentagePrice: number | null;
  /** НКД на одну облигацию */
  aci: Money | null;
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
  /** true - постоянный купон, false - переменный (флоатер); null - неизвестно */
  isFixed: boolean | null;
  /** Эффективная доходность к погашению в % годовых, с учётом НКД и амортизации; null - посчитать нельзя */
  yieldToMaturity: number | null;
  /** Эффективная доходность к оферте в % годовых; null - оферты нет или посчитать нельзя */
  yieldToOffer: number | null;
  /** График выплат - только в карточке облигации, в списках null */
  couponData: CouponPayment[] | null;
}

export interface Bond {
  ticker: string;
  uid: string;
  isin: string | null;
  name: string | null;
  sector: string | null;
  price: Price | null;
  coupon: Coupon | null;
  riskLevel: RiskLevel | null;
  maturityDate: string | null;
  /** Дата ближайшей оферты; null - оферты нет */
  offerDate: string | null;
  /** Номинал гасится частями */
  amortizationFlag: boolean;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type BondSortField =
  | 'RISK_LEVEL'
  | 'COUPON_INTEREST'
  | 'MATURITY_DATE'
  | 'TICKER'
  | 'NAME'
  | 'PRICE'
  | 'PERCENTAGE_PRICE'
  | 'YIELD_TO_MATURITY'
  | 'YIELD_TO_OFFER';

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
  /** true - только постоянный купон, false - только переменный (флоатеры) */
  isFixedCoupon?: boolean;
}

/** Облигация в результатах поиска - только общие сведения */
export interface BondSearchItem {
  ticker: string;
  uid: string;
  isin: string | null;
  name: string | null;
  sector: string | null;
  currency: string | null;
  riskLevel: RiskLevel | null;
  maturityDate: string | null;
}

/** Параметры калькулятора дохода; даты - YYYY-MM-DD, все поля необязательны */
export interface ProfitCalculationRequest {
  buyDate?: string;
  /** Не раньше погашения - держим до погашения, в дату оферты - выкуп по номиналу */
  sellDate?: string;
  quantity?: number;
  /** Цена покупки в % от номинала; не задана - текущая */
  buyPricePercent?: number;
  /** Цена продажи в % от номинала; не задана - текущая */
  sellPricePercent?: number;
  /** Ставка НДФЛ в %; не задана - налог не учитывается */
  taxRatePercent?: number;
}

/** Как облигация выходит из позиции: продажа, выкуп по оферте или погашение */
export type ExitType = 'SALE' | 'OFFER' | 'MATURITY';

/** Доход за период. Суммы - на всё количество, в валюте номинала */
export interface ProfitCalculation {
  ticker: string;
  currency: string;
  quantity: number;
  buyDate: string;
  sellDate: string;
  days: number;
  exitType: ExitType;
  buyPricePercent: number;
  sellPricePercent: number;
  purchaseAmount: number;
  purchaseAci: number;
  couponIncome: number;
  couponCount: number;
  amortizationIncome: number;
  exitAmount: number;
  exitAci: number;
  profit: number;
  profitPercent: number;
  /** % годовых без сложного процента */
  annualProfitPercent: number;
  /** Ставка НДФЛ в %; null - налог не учитывался */
  taxRatePercent: number | null;
  /** НДФЛ с положительного дохода; без налога - 0 */
  tax: number;
  netProfit: number;
  netProfitPercent: number;
  unknownCouponCount: number;
  aciUnknown: boolean;
  amortizationScheduleMissing: boolean;
}

/** Интервал свечей графика: день, неделя (с понедельника), месяц */
export type CandleInterval = 'DAY' | 'WEEK' | 'MONTH';

/** Свеча цены в % от номинала; date - YYYY-MM-DD, у недели и месяца - первый день периода */
export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Объём в лотах */
  volume: number;
}

/** Выборка облигаций: все, рублёвые или в иностранной валюте */
export type BondScope = 'all' | 'local' | 'foreign';

/**
 * Источник новости: Банк России (пресс-релизы, «События и комментарии»), Мосбиржа, рейтинговые агентства АКРА и НКР
 * (у их релизов только дата), СМИ
 */
export type NewsSource =
  | 'CBR_PRESS'
  | 'CBR_EVENT'
  | 'MOEX'
  | 'ACRA'
  | 'NKR'
  | 'INTERFAX'
  | 'RBC'
  | 'KOMMERSANT'
  | 'VEDOMOSTI'
  | 'FINAM'
  | 'FRANK_MEDIA'
  | 'SMART_LAB';

/** Облигация из системы, упомянутая в новости */
export interface NewsBond {
  ticker: string;
  name: string | null;
}

/** Внешняя новость: заголовок, короткий анонс (есть не у всех источников) и ссылка на источник */
export interface NewsItem {
  id: number;
  source: NewsSource;
  title: string;
  summary: string | null;
  url: string | null;
  publishedAt: string;
  /** Облигации из системы, упомянутые по ISIN */
  bonds: NewsBond[] | null;
  /** Эмитенты, к которым относится новость */
  issuers: string[] | null;
}

export interface CurrencyRate {
  code: string;
  /** Рублей за единицу валюты по курсу ЦБ */
  rate: number;
  /** Изменение к прошлому курсу, рубли */
  change: number;
}

/** Ключевая ставка и курсы ЦБ; поля ставки null, если ЦБ не ответил */
export interface MarketOverview {
  keyRate: number | null;
  /** YYYY-MM-DD - с какого дня действует ставка */
  keyRateSince: string | null;
  previousKeyRate: number | null;
  currencies: CurrencyRate[] | null;
}

export type BondEventType = 'COUPON' | 'AMORTIZATION' | 'OFFER' | 'MATURITY';

/** Событие облигации из её графика выплат и дат - не внешняя новость */
export interface BondEvent {
  type: BondEventType;
  /** YYYY-MM-DD */
  date: string;
  /** Выплата на одну облигацию; null - размер не объявлен или выплаты нет (оферта) */
  amount: Money | null;
  /** Прошлый размер купона, если он изменился */
  previousAmount: Money | null;
}
