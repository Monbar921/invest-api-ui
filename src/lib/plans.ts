import type { Plan, PlanFeature, PlanLimit } from '../api/types';
import { formatNumber, formatRub } from './format';

/** Подписи лимитов тарифа; порядок - порядок строк в сравнении тарифов */
export const PLAN_LIMIT_LABELS: Record<PlanLimit, string> = {
  ALERTS: 'Правила уведомлений',
  PORTFOLIO_POSITIONS: 'Покупки в портфеле',
};

/** Подписи фич тарифа */
export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  CALENDAR_ICS: 'Подписка на календарь выплат (.ics)',
};

/** Цена тарифа: целые рубли без копеек - «299 ₽», иначе «299,50 ₽» */
export function formatPrice(value: number | null): string {
  return value != null && Number.isInteger(value) ? `${formatNumber(value)} ₽` : formatRub(value);
}

/** «299 ₽ за 1 месяц»; не продаётся - null */
export function planPrice(plan: Plan): string | null {
  if (plan.price == null) {
    return null;
  }
  return plan.periodTitle ? `${formatPrice(plan.price)} за ${plan.periodTitle}` : formatPrice(plan.price);
}
