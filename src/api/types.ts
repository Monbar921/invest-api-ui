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
  /** Эмитент по данным Мосбиржи - только в карточке облигации; null - неизвестен */
  issuer?: IssuerRef | null;
}

/** Эмитент выпуска - для ссылки на его страницу */
export interface IssuerRef {
  /** id эмитента на Мосбирже */
  id: number;
  /** «ПАО "Селигдар"» */
  shortTitle: string | null;
}

/** Эмитент с выпусками из системы (по дате погашения) */
export interface Issuer {
  id: number;
  /** Полное название: «Публичное акционерное общество "Селигдар"» */
  title: string | null;
  shortTitle: string | null;
  inn: string | null;
  bonds: Bond[];
}

/** Подборка облигаций на готовом фильтре */
export interface BondCollection {
  slug: string;
  title: string;
  description: string;
}

export interface BondCollectionPage extends BondCollection {
  bonds: Page<Bond>;
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
  /** Дата погашения в диапазоне (YYYY-MM-DD, включительно); облигация без даты погашения не подходит */
  maturityDate?: { from?: string; to?: string };
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
  /** Ставка вклада, % годовых, для сравнения с вкладом на ту же сумму; не задана - не сравнивать */
  depositRatePercent?: number;
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
  /**
   * Вклад на ту же сумму (покупка с НКД) на тот же срок: простые проценты, НДФЛ по той же ставке.
   * null - ставка вклада не задана
   */
  depositRatePercent: number | null;
  depositProfit: number | null;
  depositTax: number | null;
  depositNetProfit: number | null;
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
  /** Изменение с начала года, п.п. */
  keyRateYearChange: number | null;
  /** YYYY-MM-DD - последнее прошедшее заседание ЦБ по ставке */
  keyRateMeetingDate: string | null;
  /** Изменение по итогам последнего заседания, п.п.; 0 - ставку сохранили */
  keyRateMeetingChange: number | null;
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

/** Telegram пользователя: включён ли бот на сервере, привязан ли чат, отвечает ли Telegram */
export interface TelegramStatus {
  /** false - бот выключен в настройках invest-api, подключить нельзя */
  enabled: boolean;
  botUsername: string | null;
  linked: boolean;
  /** @username в Telegram на момент привязки; может отсутствовать */
  username: string | null;
  linkedAt: string | null;
  /** Последнее обращение сервера к Telegram успешно; null - обращений ещё не было */
  available: boolean | null;
  checkedAt: string | null;
}

/** Одноразовая ссылка привязки: https://t.me/<bot>?start=<токен> */
export interface TelegramLink {
  url: string;
  expiresAt: string;
}

/** Правило по дате события облигации: предупредить за days дней */
export type DateAlertType = 'COUPON_BEFORE' | 'AMORTIZATION_BEFORE' | 'OFFER_BEFORE' | 'MATURITY_BEFORE';

/**
 * Правило по цене и доходности: уровень цены (% от номинала), изменение цены в % (от цены при создании или за день),
 * уровень доходности к погашению или к оферте (% годовых)
 */
export type PriceAlertType = 'PRICE_LEVEL' | 'PRICE_CHANGE' | 'PRICE_DAILY_CHANGE' | 'YTM_LEVEL' | 'YTO_LEVEL';

/** Правило по событию: объявлен купон, новости облигации, рейтинги эмитента, решения по ключевой ставке */
export type EventAlertType = 'FLOATER_COUPON' | 'BOND_NEWS' | 'ISSUER_RATING' | 'KEY_RATE';

export type AlertType = DateAlertType | PriceAlertType | EventAlertType;

/** UP - выросло до уровня или на порог, DOWN - снизилось, ANY - в любую сторону (только изменения цены) */
export type AlertDirection = 'UP' | 'DOWN' | 'ANY';

/** Правило уведомления пользователя по облигации */
export interface Alert {
  id: number;
  /** null - правило без облигации (KEY_RATE) */
  ticker: string | null;
  /** null - облигации уже нет в системе */
  bondName: string | null;
  isin: string | null;
  type: AlertType;
  /** 1..60; только у правил по датам */
  days: number | null;
  /** Только у правил по цене и доходности */
  direction: AlertDirection | null;
  /** Уровень (% от номинала, % годовых) или изменение цены в % */
  threshold: number | null;
  /** У PRICE_CHANGE: цена при создании или включении, % от номинала */
  baseValue: number | null;
  /** У уровней: взведено или уже сработало (снова взведётся, когда значение вернётся за порог) */
  state: 'ARMED' | 'TRIGGERED' | null;
  enabled: boolean;
  createdAt: string;
  /** Когда правило последний раз поставило уведомление в очередь */
  lastTriggeredAt: string | null;
}

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

/** Уведомление из истории */
export interface NotificationItem {
  id: number;
  /** null - правило удалено */
  alertId: number | null;
  ticker: string | null;
  text: string;
  status: NotificationStatus;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
  /** Почему не отправлено; у PENDING - ошибка последней попытки */
  lastError: string | null;
}

/** Позиция портфеля - одна покупка облигации с текущей оценкой. Суммы - в валюте номинала, на всё количество */
export interface PortfolioPosition {
  id: number;
  ticker: string;
  /** null - облигации уже нет в системе */
  bondName: string | null;
  isin: string | null;
  /** Валюта номинала */
  currency: string | null;
  quantity: number;
  /** YYYY-MM-DD */
  buyDate: string;
  /** Имя брокера; null - не указан */
  broker: string | null;
  /** Текущий номинал одной облигации */
  nominal: number | null;
  /** Цена покупки, % от номинала */
  buyPrice: number;
  /** Текущая цена, % от номинала; null - цены нет */
  currentPrice: number | null;
  /** Номинал × цена покупки × количество */
  buyAmount: number | null;
  /** Номинал × текущая цена × количество; null - цены нет */
  currentAmount: number | null;
  /** Текущая стоимость − стоимость покупки; отрицательный - убыток */
  revenue: number | null;
  /** Доход в % к стоимости покупки */
  revenuePercent: number | null;
  /** Сколько рублей заплачено, как ввёл пользователь; null - не вводил */
  buyAmountRub: number | null;
  /** Стоимость покупки в рублях: введённая сумма, иначе по курсу ЦБ на дату покупки; null - курса нет */
  buyAmountInRub: number | null;
  /** Текущая стоимость в рублях по курсу ЦБ на сегодня; null - цены или курса нет */
  currentAmountInRub: number | null;
  /**
   * Доход в рублях: текущая стоимость в рублях − стоимость покупки в рублях, то есть вместе с изменением курса валюты;
   * null - цены или одного из курсов нет
   */
  revenueInRub: number | null;
  /** Доходность к погашению, если купить сегодня по цене этой покупки (с сегодняшним НКД), % годовых */
  yieldToMaturity: number | null;
  createdAt: string;
}

/** Итог портфеля в одной валюте номинала; позиции без цены не входят */
export interface PortfolioTotal {
  currency: string;
  buyAmount: number;
  currentAmount: number;
  revenue: number;
  revenuePercent: number | null;
  /** Сумма стоимостей покупки в рублях по курсам на даты покупок */
  buyAmountInRub: number | null;
  /** Сумма текущих стоимостей в рублях по курсу на сегодня */
  currentAmountInRub: number | null;
  /** Текущая стоимость в рублях − стоимость покупки в рублях; null, если у какой-то покупки нет курса */
  revenueInRub: number | null;
}

/** Все покупки одной облигации одной строкой: суммы - сложение сумм покупок, в валюте номинала */
export interface PortfolioGroup {
  ticker: string;
  /** null - облигации уже нет в системе */
  bondName: string | null;
  isin: string | null;
  currency: string | null;
  /** Сколько облигаций во всех покупках */
  quantity: number;
  /** Разные брокеры покупок по имени */
  brokers: string[];
  /** YYYY-MM-DD */
  firstBuyDate: string;
  lastBuyDate: string;
  nominal: number | null;
  /** Средняя цена покупки, % от номинала, взвешенная по количеству */
  buyPrice: number;
  currentPrice: number | null;
  buyAmount: number | null;
  currentAmount: number | null;
  revenue: number | null;
  revenuePercent: number | null;
  buyAmountInRub: number | null;
  currentAmountInRub: number | null;
  revenueInRub: number | null;
  /** Купон, % годовых от номинала */
  couponRate: number | null;
  /** Доходность к погашению по средней цене покупки (как если бы купить сегодня по ней), % годовых */
  yieldToMaturity: number | null;
  /** Доходность к погашению по текущей цене, % годовых */
  currentYieldToMaturity: number | null;
  /** Покупки по дате */
  positions: PortfolioPosition[];
}

/** Весь портфель в рублях: сумма рублёвых сумм итогов по всем валютам */
export interface PortfolioSummary {
  buyAmountInRub: number;
  currentAmountInRub: number;
  revenueInRub: number;
  revenuePercent: number | null;
}

export interface Portfolio {
  /** Строка на облигацию, по тикеру */
  groups: PortfolioGroup[];
  totals: PortfolioTotal[];
  /** null - портфель пуст или у какой-то валюты нет курса */
  summary: PortfolioSummary | null;
}

/** Покупка в портфель; при изменении тикер не используется */
export interface PortfolioPositionRequest {
  ticker?: string;
  quantity: number;
  /** % от номинала */
  buyPrice: number;
  /** YYYY-MM-DD; не задана - сегодня */
  buyDate?: string;
  /** Имя брокера: такого у пользователя нет - бэк его создаёт; пусто - без брокера */
  broker?: string;
  /** Только у валютной облигации: сколько рублей заплачено, без НКД и комиссии; не задано - по курсу ЦБ */
  buyAmountRub?: number;
}

/** Ссылка на покупку облигации у брокера-партнёра. Это реклама: показывается с пометкой, рекламодателем и erid */
export interface BrokerLink {
  partnerId: string;
  name: string;
  url: string;
  /** Рекламодатель: наименование и ИНН */
  advertiser: string;
  /** Токен рекламы из ЕРИР */
  erid: string | null;
}

/** Брокер пользователя - метка покупки */
export interface Broker {
  id: number;
  name: string;
}
