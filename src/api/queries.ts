import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calculateProfit,
  fetchBond,
  fetchBondEvents,
  fetchBondNews,
  fetchBondsPage,
  fetchCandles,
  fetchMarketOverview,
  fetchNews,
  searchBonds,
} from './bonds';
import { ApiError } from './client';
import {
  type AlertChanges,
  type AlertRule,
  createAlert,
  deleteAlert,
  fetchAlerts,
  fetchNotifications,
  updateAlert,
} from './alerts';
import { createTelegramLink, fetchTelegramStatus, unlinkTelegram } from './telegram';
import type { BondParameters, BondScope, CandleInterval, NewsSource, Page, ProfitCalculationRequest } from './types';

export const bondKeys = {
  all: ['bonds'] as const,
  page: (scope: BondScope, page: number, size: number, parameters: BondParameters) =>
    [...bondKeys.all, 'page', scope, page, size, parameters] as const,
  detail: (ticker: string) => [...bondKeys.all, 'detail', ticker] as const,
  search: (query: string) => [...bondKeys.all, 'search', query] as const,
  calculation: (ticker: string, parameters: ProfitCalculationRequest) =>
    [...bondKeys.all, 'calculation', ticker, parameters] as const,
  candles: (ticker: string, interval: CandleInterval, from: string | undefined) =>
    [...bondKeys.all, 'candles', ticker, interval, from ?? 'all'] as const,
  events: (ticker: string) => [...bondKeys.all, 'events', ticker] as const,
  bondNews: (ticker: string) => [...bondKeys.all, 'news', ticker] as const,
};

export const newsKeys = {
  all: ['news'] as const,
  feed: (sources: NewsSource[]) => [...newsKeys.all, 'feed', ...sources] as const,
  overview: () => [...newsKeys.all, 'overview'] as const,
};

/** Сколько новостей подгружать за раз */
export const NEWS_PAGE_SIZE = 20;
// новости загружаются на бэке раз в 15 минут
const NEWS_STALE_TIME = 5 * 60 * 1000;

const nextNewsPage = (last: Page<unknown>) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined);

/** Как и на бэке: запрос короче двух символов ничего не ищет */
export const MIN_SEARCH_LENGTH = 2;

export function useBondsPage(scope: BondScope, page: number, size: number, parameters: BondParameters) {
  return useQuery({
    queryKey: bondKeys.page(scope, page, size, parameters),
    queryFn: () => fetchBondsPage(scope, page, size, parameters),
    // при смене страницы или фильтра таблица показывает прежние строки, пока грузятся новые
    placeholderData: keepPreviousData,
  });
}

export function useBond(ticker: string) {
  return useQuery({
    queryKey: bondKeys.detail(ticker),
    queryFn: () => fetchBond(ticker),
    // 404 повторять бессмысленно
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}

export function useBondSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: bondKeys.search(trimmed),
    queryFn: () => searchBonds(trimmed),
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
    // пока ищется новый запрос, список подсказок не пропадает
    placeholderData: keepPreviousData,
  });
}

export function useProfitCalculation(ticker: string, parameters: ProfitCalculationRequest, enabled: boolean) {
  return useQuery({
    queryKey: bondKeys.calculation(ticker, parameters),
    queryFn: () => calculateProfit(ticker, parameters),
    enabled,
    placeholderData: keepPreviousData,
    // 422 - параметры не подходят облигации, повтор не поможет
    retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
  });
}

export function useBondCandles(ticker: string, interval: CandleInterval, from: string | undefined) {
  return useQuery({
    queryKey: bondKeys.candles(ticker, interval, from),
    queryFn: () => fetchCandles(ticker, interval, from),
    // при смене интервала или периода график не пропадает, пока грузится новый
    placeholderData: keepPreviousData,
    // свечи обновляются раз в сутки ночной синхронизацией
    staleTime: 5 * 60 * 1000,
  });
}

/** Лента новостей с подгрузкой по кнопке «Показать ещё» */
export function useNewsFeed(sources: NewsSource[]) {
  return useInfiniteQuery({
    queryKey: newsKeys.feed(sources),
    queryFn: ({ pageParam }) => fetchNews(sources, pageParam, NEWS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: nextNewsPage,
    staleTime: NEWS_STALE_TIME,
  });
}

export function useBondNews(ticker: string) {
  return useInfiniteQuery({
    queryKey: bondKeys.bondNews(ticker),
    queryFn: ({ pageParam }) => fetchBondNews(ticker, pageParam, NEWS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: nextNewsPage,
    staleTime: NEWS_STALE_TIME,
  });
}

export function useMarketOverview() {
  return useQuery({
    queryKey: newsKeys.overview(),
    queryFn: fetchMarketOverview,
    // курс ЦБ меняется раз в день, ставка - несколько раз в год
    staleTime: 30 * 60 * 1000,
  });
}

export function useBondEvents(ticker: string) {
  return useQuery({
    queryKey: bondKeys.events(ticker),
    queryFn: () => fetchBondEvents(ticker),
    staleTime: NEWS_STALE_TIME,
  });
}

export const telegramKeys = {
  status: ['telegram', 'status'] as const,
};

/** Пока пользователь открывает ссылку в Telegram, статус опрашивается - привязка появится после /start в боте */
const TELEGRAM_LINK_POLL_INTERVAL = 3000;

/**
 * Статус Telegram. Запрашивается только когда открыта панель (enabled), а пока ждём привязку - каждые 3 секунды.
 */
export function useTelegramStatus(enabled: boolean, waitingForLink: boolean) {
  return useQuery({
    queryKey: telegramKeys.status,
    queryFn: fetchTelegramStatus,
    enabled,
    refetchInterval: (query) => (waitingForLink && query.state.data?.linked !== true ? TELEGRAM_LINK_POLL_INTERVAL : false),
  });
}

export function useCreateTelegramLink() {
  return useMutation({ mutationFn: createTelegramLink });
}

export function useUnlinkTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkTelegram,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: telegramKeys.status }),
  });
}

export const alertKeys = {
  all: ['alerts'] as const,
  list: () => [...alertKeys.all, 'list'] as const,
  notifications: () => [...alertKeys.all, 'notifications'] as const,
};

/** Сколько уведомлений истории подгружать за раз */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * Все правила пользователя одним запросом: и колокольчики в таблице, и диалог облигации, и страница уведомлений
 * берут их отсюда - таблица на 50 строк не делает 50 запросов.
 */
export function useAlerts() {
  return useQuery({ queryKey: alertKeys.list(), queryFn: fetchAlerts });
}

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: alertKeys.notifications(),
    queryFn: ({ pageParam }) => fetchNotifications(pageParam, NOTIFICATIONS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: nextNewsPage,
  });
}

/** Создание, изменение и удаление правила; после - список правил и история перечитываются */
export function useAlertMutations() {
  const queryClient = useQueryClient();
  // правило могло сразу поставить уведомление в очередь - история тоже меняется
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: alertKeys.all });
  return {
    create: useMutation({ mutationFn: (rule: AlertRule) => createAlert(rule), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, ...changes }: AlertChanges & { id: number }) => updateAlert(id, changes),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: deleteAlert, onSuccess }),
  };
}
