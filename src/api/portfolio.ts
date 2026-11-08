import { request } from './client';
import type { Broker, Portfolio, PortfolioPosition, PortfolioPositionRequest } from './types';

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
