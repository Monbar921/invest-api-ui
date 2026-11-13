import { formatChange, formatMoney } from './format';

/** Сумма в валюте; null - прочерк */
export function money(value: number | null | undefined, currency: string | null | undefined): string {
  return formatMoney({ quantity: value ?? null, currency: currency ?? null });
}

/** Сумма со знаком: прибыль с «+», убыток с «−» */
export function signedMoney(value: number | null | undefined, currency: string | null | undefined): string {
  if (value == null) {
    return '—';
  }
  const formatted = money(Math.abs(value), currency);
  if (value > 0) {
    return `+${formatted}`;
  }
  return value < 0 ? `−${formatted}` : formatted;
}

export function signedPercent(value: number | null | undefined): string {
  return value == null ? '—' : `${formatChange(value)} %`;
}

/** Цвет дохода: прибыль зелёная, убыток красный */
export function revenueColor(value: number | null | undefined): string | undefined {
  if (value == null || value === 0) {
    return undefined;
  }
  return value > 0 ? 'teal' : 'red';
}
