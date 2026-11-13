import type { Money, RiskLevel } from '../api/types';

const LOCALE = 'ru-RU';
const EMPTY = '—';

const numberFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatNumber(value: number | null | undefined): string {
  return value == null ? EMPTY : numberFormat.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? EMPTY : `${numberFormat.format(value)} %`;
}

const priceFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 4 });

/** Цена сделки в % номинала - с точностью, как её вводят (до 4 знаков): 67,635 %, а не 67,64 % */
export function formatPricePercent(value: number | null | undefined): string {
  return value == null ? EMPTY : `${priceFormat.format(value)} %`;
}

/** Бэк отдаёт валюту в нижнем регистре (rub, usd), Intl ждёт ISO-код в верхнем */
export function formatMoney(money: Money | null | undefined): string {
  if (money?.quantity == null) {
    return EMPTY;
  }

  const currency = money.currency?.toUpperCase();
  if (!currency) {
    return numberFormat.format(money.quantity);
  }

  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
    }).format(money.quantity);
  } catch {
    // код валюты, который Intl не знает
    return `${numberFormat.format(money.quantity)} ${currency}`;
  }
}

export function formatRub(value: number | null | undefined): string {
  return formatMoney({ quantity: value ?? null, currency: 'rub' });
}

/** Цена в рублях (бэк отдаёт RUB или устаревший код RUR) - вторая строка с ценой в валюте не нужна */
export function isRubCurrency(currency: string | null | undefined): boolean {
  const code = currency?.toUpperCase();
  return code === 'RUB' || code === 'RUR';
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return EMPTY;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY : dateFormat.format(date);
}

/** «05.11.2026, 16:05» в часовом поясе браузера */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return EMPTY;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY : dateTimeFormat.format(date);
}

/** Изменение со знаком: «+0,3», «−0,25»; ноль - без знака */
export function formatChange(value: number | null | undefined): string {
  if (value == null) {
    return EMPTY;
  }
  const formatted = numberFormat.format(Math.abs(value));
  if (value > 0) {
    return `+${formatted}`;
  }
  return value < 0 ? `−${formatted}` : formatted;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** «через 2,4 года», «через 45 дней», «погашена» */
export function formatTimeToMaturity(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) {
    return EMPTY;
  }

  const days = Math.ceil((new Date(value).getTime() - now.getTime()) / MS_PER_DAY);
  if (Number.isNaN(days)) {
    return EMPTY;
  }
  if (days <= 0) {
    return 'погашена';
  }
  if (days < 365) {
    return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`;
  }

  const years = Math.round((days / 365) * 10) / 10;
  // с дробным числом всегда «года»: 2,4 года, 12,2 года; с целым - по обычным правилам: 3 года, 5 лет
  const unit = Number.isInteger(years) ? plural(years, 'год', 'года', 'лет') : 'года';
  return `через ${numberFormat.format(years)} ${unit}`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }
  return many;
}

export const RISK_LEVELS: Record<RiskLevel, { label: string; color: string }> = {
  RISK_LEVEL_LOW: { label: 'Низкий', color: 'teal' },
  RISK_LEVEL_MODERATE: { label: 'Средний', color: 'yellow' },
  RISK_LEVEL_HIGH: { label: 'Высокий', color: 'red' },
  RISK_LEVEL_UNSPECIFIED: { label: 'Не указан', color: 'gray' },
  UNRECOGNIZED: { label: 'Неизвестен', color: 'gray' },
};

/** Уровни, по которым имеет смысл фильтровать */
export const FILTERABLE_RISK_LEVELS: RiskLevel[] = ['RISK_LEVEL_LOW', 'RISK_LEVEL_MODERATE', 'RISK_LEVEL_HIGH'];

/** «постоянный» / «переменный»; null - тип купона неизвестен */
export function couponTypeLabel(isFixed: boolean | null | undefined): string | null {
  if (isFixed == null) {
    return null;
  }
  return isFixed ? 'постоянный' : 'переменный';
}

/** Сектор из T-Invest API (government, financial, ...) по-русски; неизвестный код - как есть */
const SECTORS: Record<string, string> = {
  government: 'Госсектор',
  municipal: 'Муниципальные',
  financial: 'Финансы',
  energy: 'Энергетика',
  utilities: 'Электроэнергетика',
  industrials: 'Промышленность',
  consumer: 'Потребительский',
  telecom: 'Телекоммуникации',
  it: 'IT',
  real_estate: 'Недвижимость',
  materials: 'Сырьё',
  health_care: 'Здравоохранение',
  other: 'Другое',
};

export function formatSector(sector: string | null | undefined): string {
  if (!sector) {
    return EMPTY;
  }
  return SECTORS[sector.toLowerCase()] ?? sector;
}
