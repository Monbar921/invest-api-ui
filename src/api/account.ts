import { request } from './client';
import type { AccountPlan } from './types';

// gateway пропускает /api/account/** в invest-api и добавляет пользователя из сессии
const ACCOUNT_PATH = '/api/account';

/** Тариф пользователя: действующий, срок, лимиты с использованием и все тарифы */
export function fetchAccountPlan(): Promise<AccountPlan> {
  return request<AccountPlan>(`${ACCOUNT_PATH}/plan`);
}
