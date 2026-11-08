import { request } from './client';
import type { Alert, AlertDirection, AlertType, NotificationItem, Page } from './types';

// gateway пропускает /api/alerts/** в invest-api и добавляет пользователя из сессии
const ALERTS_PATH = '/api/alerts';

/** Самое раннее предупреждение, дней - как на бэке */
export const MAX_ALERT_DAYS = 60;

export function fetchAlerts(): Promise<Alert[]> {
  return request<Alert[]>(ALERTS_PATH);
}

/** Новое правило: по дате - days, по цене и доходности - direction и threshold */
export interface AlertRule {
  /** Не задаётся только у KEY_RATE */
  ticker?: string;
  type: AlertType;
  days?: number;
  direction?: AlertDirection;
  threshold?: number;
}

export interface AlertChanges {
  days?: number;
  direction?: AlertDirection;
  threshold?: number;
  enabled?: boolean;
}

export function createAlert(rule: AlertRule): Promise<Alert> {
  return request<Alert>(ALERTS_PATH, { method: 'POST', body: JSON.stringify(rule) });
}

export function updateAlert(id: number, changes: AlertChanges): Promise<Alert> {
  return request<Alert>(`${ALERTS_PATH}/${id}`, { method: 'PUT', body: JSON.stringify(changes) });
}

export function deleteAlert(id: number): Promise<void> {
  return request<void>(`${ALERTS_PATH}/${id}`, { method: 'DELETE' });
}

export function fetchNotifications(page: number, size: number): Promise<Page<NotificationItem>> {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  return request<Page<NotificationItem>>(`${ALERTS_PATH}/notifications?${query}`);
}
