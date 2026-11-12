import { absoluteApiUrl, request } from './client';
import type { Broker, CalendarLink, Portfolio, PortfolioCalendar, PortfolioPosition, PortfolioPositionRequest } from './types';

// gateway пропускает /api/portfolio/** в invest-api и добавляет пользователя из сессии
const PORTFOLIO_PATH = '/api/portfolio';

/** Пределы - как на бэке */
export const MAX_POSITION_QUANTITY = 1_000_000;
export const MAX_BUY_PRICE = 300;
export const MAX_BROKER_LENGTH = 100;

export function fetchPortfolio(): Promise<Portfolio> {
  return request<Portfolio>(PORTFOLIO_PATH);
}

export function createPosition(position: PortfolioPositionRequest): Promise<PortfolioPosition> {
  return request<PortfolioPosition>(`${PORTFOLIO_PATH}/positions`, { method: 'POST', body: JSON.stringify(position) });
}

export function updatePosition(id: number, position: PortfolioPositionRequest): Promise<PortfolioPosition> {
  return request<PortfolioPosition>(`${PORTFOLIO_PATH}/positions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(position),
  });
}

export function deletePosition(id: number): Promise<void> {
  return request<void>(`${PORTFOLIO_PATH}/positions/${id}`, { method: 'DELETE' });
}

/** Брокеры пользователя по имени: новый появляется, когда его впервые указывают у покупки */
export function fetchBrokers(): Promise<Broker[]> {
  return request<Broker[]>(`${PORTFOLIO_PATH}/brokers`);
}

/** Календарь выплат с сегодня по to (YYYY-MM-DD включительно); to не задан - год */
export function fetchPortfolioCalendar(to?: string): Promise<PortfolioCalendar> {
  const query = to ? `?${new URLSearchParams({ to })}` : '';
  return request<PortfolioCalendar>(`${PORTFOLIO_PATH}/calendar${query}`);
}

/** Есть ли личная ссылка на календарь; адреса в ответе нет */
export function fetchCalendarLink(): Promise<CalendarLink> {
  return request<CalendarLink>(`${PORTFOLIO_PATH}/calendar/link`);
}

/** Новая ссылка с токеном; прежняя перестаёт работать */
export function createCalendarLink(): Promise<CalendarLink> {
  return request<CalendarLink>(`${PORTFOLIO_PATH}/calendar/link`, { method: 'POST' });
}

export function deleteCalendarLink(): Promise<void> {
  return request<void>(`${PORTFOLIO_PATH}/calendar/link`, { method: 'DELETE' });
}

/**
 * Адрес подписки: gateway пропускает /api/calendar/** без сессии - календари (Google, Apple, Outlook) забирают его
 * со своих серверов, пользователя определяет токен
 */
export function calendarFeedUrl(token: string): string {
  return absoluteApiUrl(`/api/calendar/${encodeURIComponent(token)}.ics`);
}
