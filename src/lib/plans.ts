import type { PlanFeature, PlanLimit } from '../api/types';

/** Подписи лимитов тарифа; порядок - порядок строк в сравнении тарифов */
export const PLAN_LIMIT_LABELS: Record<PlanLimit, string> = {
  ALERTS: 'Правила уведомлений',
  PORTFOLIO_POSITIONS: 'Покупки в портфеле',
};

/** Подписи фич тарифа */
export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  CALENDAR_ICS: 'Подписка на календарь выплат (.ics)',
};
