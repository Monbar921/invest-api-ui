import type { AlertType, NotificationStatus } from '../api/types';

/** Правила по датам в порядке показа: подпись, подсказка и сколько дней предлагать по умолчанию */
export const ALERT_TYPES: { type: AlertType; label: string; hint: string; defaultDays: number }[] = [
  { type: 'COUPON_BEFORE', label: 'Купон', hint: 'дата и размер выплаты', defaultDays: 3 },
  { type: 'AMORTIZATION_BEFORE', label: 'Частичное погашение', hint: 'выплата части номинала', defaultDays: 3 },
  // по оферте нужно успеть подать заявку - предупреждаем заранее
  { type: 'OFFER_BEFORE', label: 'Оферта', hint: 'можно предъявить к выкупу', defaultDays: 14 },
  { type: 'MATURITY_BEFORE', label: 'Погашение', hint: 'возврат номинала', defaultDays: 7 },
];

export function alertTypeLabel(type: AlertType): string {
  return ALERT_TYPES.find((item) => item.type === type)?.label ?? type;
}

export const NOTIFICATION_STATUSES: Record<NotificationStatus, { label: string; color: string }> = {
  PENDING: { label: 'Ждёт отправки', color: 'yellow' },
  SENT: { label: 'Отправлено', color: 'green' },
  FAILED: { label: 'Не отправлено', color: 'red' },
};
