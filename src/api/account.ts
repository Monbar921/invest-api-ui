import { request } from './client';
import type { AccountPlan, Payment } from './types';

// gateway пропускает /api/account/** в invest-api и добавляет пользователя из сессии
const ACCOUNT_PATH = '/api/account';

/** Тариф пользователя: действующий, срок, лимиты с использованием и все тарифы */
export function fetchAccountPlan(): Promise<AccountPlan> {
  return request<AccountPlan>(`${ACCOUNT_PATH}/plan`);
}

/** Купить тариф: в ответе confirmationUrl - страница оплаты Т-Кассы */
export function createPayment(plan: string): Promise<Payment> {
  return request<Payment>(`${ACCOUNT_PATH}/payments`, { method: 'POST', body: JSON.stringify({ plan }) });
}

/** Платежи пользователя, новые первыми */
export function fetchPayments(): Promise<Payment[]> {
  return request<Payment[]>(`${ACCOUNT_PATH}/payments`);
}

/** Платёж; пока ждёт оплаты, бэк уточняет статус у провайдера */
export function fetchPayment(id: number): Promise<Payment> {
  return request<Payment>(`${ACCOUNT_PATH}/payments/${id}`);
}

/** Отключить автопродление: тариф действует до конца оплаченного срока */
export function cancelAutoRenewal(): Promise<void> {
  return request<void>(`${ACCOUNT_PATH}/auto-renewal`, { method: 'DELETE' });
}
