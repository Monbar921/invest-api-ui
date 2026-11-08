import type {
  Alert,
  AlertDirection,
  AlertType,
  DateAlertType,
  EventAlertType,
  NotificationStatus,
  PriceAlertType,
} from '../api/types';

/** Правила по датам в порядке показа: подпись, подсказка и сколько дней предлагать по умолчанию */
export const ALERT_TYPES: { type: DateAlertType; label: string; hint: string; defaultDays: number }[] = [
  { type: 'COUPON_BEFORE', label: 'Купон', hint: 'дата и размер выплаты', defaultDays: 3 },
  { type: 'AMORTIZATION_BEFORE', label: 'Частичное погашение', hint: 'выплата части номинала', defaultDays: 3 },
  // по оферте нужно успеть подать заявку - предупреждаем заранее
  { type: 'OFFER_BEFORE', label: 'Оферта', hint: 'можно предъявить к выкупу', defaultDays: 14 },
  { type: 'MATURITY_BEFORE', label: 'Погашение', hint: 'возврат номинала', defaultDays: 7 },
];

const LEVEL_DIRECTIONS: { value: AlertDirection; label: string }[] = [
  { value: 'UP', label: 'вырастет до' },
  { value: 'DOWN', label: 'снизится до' },
];

const CHANGE_DIRECTIONS: { value: AlertDirection; label: string }[] = [
  { value: 'ANY', label: 'изменится на' },
  { value: 'DOWN', label: 'упадёт на' },
  { value: 'UP', label: 'вырастет на' },
];

/** Правила по цене и доходности: подпись, единица порога, направления, значения по умолчанию и пределы (как на бэке) */
export const PRICE_ALERT_TYPES: {
  type: PriceAlertType;
  label: string;
  unit: string;
  directions: { value: AlertDirection; label: string }[];
  defaultDirection: AlertDirection;
  defaultThreshold: number;
  min: number;
  max: number;
}[] = [
  {
    type: 'PRICE_LEVEL',
    label: 'Цена, % от номинала',
    unit: '% номинала',
    directions: [
      { value: 'DOWN', label: 'опустится до' },
      { value: 'UP', label: 'поднимется до' },
    ],
    defaultDirection: 'DOWN',
    defaultThreshold: 95,
    min: 1,
    max: 300,
  },
  {
    type: 'PRICE_CHANGE',
    label: 'Изменение цены от текущей',
    unit: '%',
    directions: CHANGE_DIRECTIONS,
    defaultDirection: 'ANY',
    defaultThreshold: 5,
    min: 0.1,
    max: 50,
  },
  {
    type: 'PRICE_DAILY_CHANGE',
    label: 'Изменение цены за день',
    unit: '%',
    directions: CHANGE_DIRECTIONS,
    defaultDirection: 'ANY',
    defaultThreshold: 2,
    min: 0.1,
    max: 50,
  },
  {
    type: 'YTM_LEVEL',
    label: 'Доходность к погашению',
    unit: '% годовых',
    directions: LEVEL_DIRECTIONS,
    defaultDirection: 'UP',
    defaultThreshold: 20,
    min: 0.1,
    max: 100,
  },
  {
    type: 'YTO_LEVEL',
    label: 'Доходность к оферте',
    unit: '% годовых',
    directions: LEVEL_DIRECTIONS,
    defaultDirection: 'UP',
    defaultThreshold: 20,
    min: 0.1,
    max: 100,
  },
];

/** Правила по событиям облигации - включаются переключателем, без параметров. Ключевая ставка - на странице уведомлений */
export const EVENT_ALERT_TYPES: { type: EventAlertType; label: string; hint: string }[] = [
  { type: 'FLOATER_COUPON', label: 'Объявлен купон', hint: 'размер следующего купона, для плавающего купона' },
  { type: 'BOND_NEWS', label: 'Новости', hint: 'по выпуску и эмитенту: биржа, ЦБ, рейтинги, СМИ' },
  { type: 'ISSUER_RATING', label: 'Рейтинги эмитента', hint: 'действия АКРА и НКР' },
];

export const KEY_RATE_ALERT = {
  type: 'KEY_RATE' as const,
  label: 'Решения Банка России по ключевой ставке',
  hint: 'пресс-релиз в день заседания',
};

export function isPriceAlert(type: AlertType): type is PriceAlertType {
  return PRICE_ALERT_TYPES.some((item) => item.type === type);
}

export function isEventAlert(type: AlertType): type is EventAlertType {
  return EVENT_ALERT_TYPES.some((item) => item.type === type) || type === 'KEY_RATE';
}

export function isDateAlert(type: AlertType): type is DateAlertType {
  return ALERT_TYPES.some((item) => item.type === type);
}

export function alertTypeLabel(type: AlertType): string {
  return (
    ALERT_TYPES.find((item) => item.type === type)?.label ??
    PRICE_ALERT_TYPES.find((item) => item.type === type)?.label ??
    EVENT_ALERT_TYPES.find((item) => item.type === type)?.label ??
    (type === 'KEY_RATE' ? KEY_RATE_ALERT.label : type)
  );
}

const number = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

/** «Цена ≤ 95% номинала», «Цена за день ±2,5%», «Доходность к погашению ≥ 20% годовых» */
export function describePriceAlert(alert: Alert): string {
  const threshold = alert.threshold == null ? '' : number(alert.threshold);
  const level = alert.direction === 'UP' ? '≥' : '≤';
  const change = alert.direction === 'UP' ? '+' : alert.direction === 'DOWN' ? '−' : '±';
  switch (alert.type) {
    case 'PRICE_LEVEL':
      return `Цена ${level} ${threshold}% номинала`;
    case 'PRICE_CHANGE':
      return `Цена ${change}${threshold}% от ${alert.baseValue == null ? 'цены при создании' : `${number(alert.baseValue)}%`}`;
    case 'PRICE_DAILY_CHANGE':
      return `Цена за день ${change}${threshold}%`;
    case 'YTM_LEVEL':
      return `Доходность к погашению ${level} ${threshold}% годовых`;
    case 'YTO_LEVEL':
      return `Доходность к оферте ${level} ${threshold}% годовых`;
    default:
      return alertTypeLabel(alert.type);
  }
}

/** Правило одной строкой: «Купон за 3 дн.», «Цена ≤ 95% номинала», «Новости» */
export function describeAlert(alert: Alert): string {
  if (isDateAlert(alert.type)) {
    return `${alertTypeLabel(alert.type)} за ${alert.days ?? ''} дн.`;
  }
  if (isPriceAlert(alert.type)) {
    return describePriceAlert(alert);
  }
  return alertTypeLabel(alert.type);
}

export const NOTIFICATION_STATUSES: Record<NotificationStatus, { label: string; color: string }> = {
  PENDING: { label: 'Ждёт отправки', color: 'yellow' },
  SENT: { label: 'Отправлено', color: 'green' },
  FAILED: { label: 'Не отправлено', color: 'red' },
};
