import { request } from './client';
import type { TelegramLink, TelegramStatus } from './types';

// gateway пропускает /api/alerts/** в invest-api и добавляет пользователя из сессии
const TELEGRAM_PATH = '/api/alerts/telegram';

export function fetchTelegramStatus(): Promise<TelegramStatus> {
  return request<TelegramStatus>(TELEGRAM_PATH);
}

export function createTelegramLink(): Promise<TelegramLink> {
  return request<TelegramLink>(`${TELEGRAM_PATH}/link-token`, { method: 'POST' });
}

export function unlinkTelegram(): Promise<void> {
  return request<void>(TELEGRAM_PATH, { method: 'DELETE' });
}
